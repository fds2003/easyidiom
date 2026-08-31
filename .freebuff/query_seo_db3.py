import sqlite3

conn = sqlite3.connect(r'E:\code\gscga4fordata\output\seo_data.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
domain = 'wordlechinese.com'

# raw seo_opportunities check
cur.execute("SELECT DISTINCT domain FROM seo_opportunities")
print("seo_opportunities domains:", [r[0] for r in cur.fetchall()])

cur.execute("SELECT * FROM seo_opportunities WHERE domain=?", (domain,))
rows = cur.fetchall()
print("rows count:", len(rows))
for r in rows[:10]:
    print(dict(r))

# Check GA4 domains
for t in ['ga4_traffic_sources','ga4_content','ga4_events','ga4_conversions','ga4_page_performance','ga4_retention']:
    cur.execute(f"SELECT DISTINCT domain FROM {t}")
    print(f"{t}: {[r[0] for r in cur.fetchall()]}")