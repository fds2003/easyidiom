import sqlite3

conn = sqlite3.connect(r'E:\code\gscga4fordata\output\seo_data.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# 1. Sites
cur.execute("SELECT * FROM sites")
print("=== SITES ===")
for r in cur.fetchall():
    print(dict(r))

# Determine the domain value used for wordlechinese.com
cur.execute("SELECT DISTINCT domain FROM page_metrics")
domains = [r[0] for r in cur.fetchall()]
print("\nDOMAINS in page_metrics:", domains)

domain = 'wordlechinese.com'
print("Using domain:", domain)

# 2. Top pages by GSC clicks
cur.execute("""
    SELECT page, SUM(gsc_clicks) as clicks, SUM(gsc_impressions) as imp,
           AVG(gsc_position) as pos
    FROM page_metrics WHERE domain=? AND gsc_clicks>0
    GROUP BY page ORDER BY clicks DESC LIMIT 30
""", (domain,))
print("\n=== TOP PAGES BY GSC CLICKS ===")
for r in cur.fetchall():
    print(f"{r['clicks']:5d} clicks | {r['imp']:6d} imp | {r['pos']:5.1f} pos | {r['page']}")

# 3. Top queries
cur.execute("""
    SELECT query, SUM(clicks) as clicks, SUM(impressions) as imp,
           AVG(position) as pos
    FROM search_queries WHERE domain=? AND clicks>0
    GROUP BY query ORDER BY clicks DESC LIMIT 40
""", (domain,))
print("\n=== TOP QUERIES BY CLICKS ===")
for r in cur.fetchall():
    print(f"{r['clicks']:5d} clicks | {r['imp']:6d} imp | {r['pos']:5.1f} pos | {r['query']}")

# 4. Sitemap status
cur.execute("SELECT * FROM gsc_sitemaps WHERE domain=?", (domain,))
print("\n=== GSC SITEMAPS ===")
for r in cur.fetchall():
    print(dict(r))