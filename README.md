# clickweb

A web-based SQL client for ClickHouse

demo: <https://sql.caseopen.org/>

## Usage

```bash
Usage: clickweb [--url <url>] -u <user> -p <password> [-a <address>]

A web-based SQL client for ClickHouse

Options:
  --url             clickHouse server URL, default to http://localhost:8123
  -u, --user        clickHouse username, must be read-only user
  -p, --password    clickHouse password
  -a, --address     address to bind the server, default to http://localhost:3001
  -h, --help, help  display usage information
```