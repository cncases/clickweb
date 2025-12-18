use std::net::SocketAddr;

use argh::FromArgs;
use axum::{
    extract::State,
    http::{HeaderMap, HeaderName, HeaderValue},
    response::{Html, IntoResponse, Json},
    routing::{get, post},
    Router,
};
use clickhouse::Client;
use serde::{Deserialize, Serialize};
use tokio::{io::AsyncBufReadExt, net::TcpListener};
use tower_http::compression::CompressionLayer;

#[derive(Clone)]
struct AppState {
    client: Client,
}

#[derive(Deserialize)]
struct QueryRequest {
    sql: String,
}

#[derive(Serialize)]
struct QueryResponse {
    columns: Vec<String>,
    rows: Vec<Vec<String>>,
    error: Option<String>,
}

#[derive(FromArgs)]
/// A web-based SQL client for ClickHouse
#[argh(help_triggers("-h", "--help", "help"))]
struct Cfg {
    /// clickHouse server URL
    #[argh(option, default = "\"http://localhost:8123\".to_string()")]
    url: String,

    /// clickHouse username, must be read-only user
    #[argh(option, short = 'u')]
    user: String,

    /// clickHouse password
    #[argh(option, short = 'p')]
    password: String,

    /// address to bind the server
    #[argh(option, short = 'a', default = "\"127.0.0.1:3001\".to_string()")]
    address: String,
}

#[tokio::main]
async fn main() {
    let cfg: Cfg = argh::from_env();

    let client = Client::default()
        .with_url(&cfg.url)
        .with_user(&cfg.user)
        .with_password(&cfg.password);

    let state = AppState { client };

    let app = Router::new()
        .route("/", get(index_handler))
        .route("/api/query", post(query_handler))
        .route("/style.css", get(style))
        .route("/app.js", get(script))
        .layer(CompressionLayer::new())
        .with_state(state);

    let listener = TcpListener::bind(cfg.address.parse::<SocketAddr>().unwrap())
        .await
        .unwrap();

    println!(
        "Server running at http://{}",
        listener.local_addr().unwrap()
    );

    axum::serve(listener, app).await.unwrap();
}

async fn index_handler() -> Html<&'static str> {
    Html(include_str!("../static/index.html"))
}

async fn query_handler(
    State(state): State<AppState>,
    Json(payload): Json<QueryRequest>,
) -> impl IntoResponse {
    let mut sql = payload.sql.trim().to_lowercase();
    if !sql.contains("limit") {
        sql.push_str(" LIMIT 2000");
    }
    match execute_query(&state.client, &payload.sql).await {
        Ok((columns, rows)) => Json(QueryResponse {
            columns,
            rows,
            error: None,
        }),
        Err(e) => Json(QueryResponse {
            columns: vec![],
            rows: vec![],
            error: Some(e.to_string()),
        }),
    }
}

async fn execute_query(
    client: &Client,
    sql: &str,
) -> Result<(Vec<String>, Vec<Vec<String>>), Box<dyn std::error::Error>> {
    println!("Executing query: {}", sql);
    let mut lines = client
        .query(sql)
        .fetch_bytes("TabSeparatedWithNames")?
        .lines();

    let mut columns = Vec::new();
    let mut rows = Vec::new();

    // Read column names from the first line
    if let Some(first_line) = lines.next_line().await? {
        columns = first_line.split('\t').map(String::from).collect();
    }

    // Read data rows
    while let Some(line) = lines.next_line().await? {
        let row: Vec<String> = line.split('\t').map(String::from).collect();
        rows.push(row);

        // Limit rows to prevent overwhelming the browser
        if rows.len() >= 2000 {
            break;
        }
    }

    Ok((columns, rows))
}

async fn style() -> (HeaderMap, &'static str) {
    let mut headers = HeaderMap::new();

    headers.insert(
        HeaderName::from_static("content-type"),
        HeaderValue::from_static("text/css"),
    );
    headers.insert(
        HeaderName::from_static("cache-control"),
        HeaderValue::from_static("public, max-age=1209600, s-maxage=86400"),
    );

    const CSS: &str = include_str!("../static/style.css");

    (headers, CSS)
}

async fn script() -> (HeaderMap, &'static str) {
    let mut headers = HeaderMap::new();

    headers.insert(
        HeaderName::from_static("content-type"),
        HeaderValue::from_static("application/javascript"),
    );
    headers.insert(
        HeaderName::from_static("cache-control"),
        HeaderValue::from_static("public, max-age=1209600, s-maxage=86400"),
    );

    const JS: &str = include_str!("../static/app.js");

    (headers, JS)
}
