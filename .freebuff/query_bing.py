import sqlite3

out = open(r'E:\code\wordlechinese\.freebuff\bing_report.txt', 'w', encoding='utf-8')
def p(*args):
    out.write(' '.join(str(a) for a in args) + '\n')

conn = sqlite3.connect(r'E:\code\gscga4fordata\output\seo_data.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
domain = 'wordlechinese.com'

cur.execute("""
    SELECT query, SUM(clicks) clicks, SUM(impressions) imp,
           AVG(avg_impression_position) pos
    FROM bing_queries WHERE domain=?
    GROUP BY query ORDER BY imp DESC LIMIT 25
""", (domain,))
p('=== BING QUERIES (top by impressions) ===')
for r in cur.fetchall():
    p(r['query'], '| clicks=', r['clicks'], '| imp=', r['imp'], '| pos=', round(r['pos'],1) if r['pos'] else None)

cur.execute("""
    SELECT page, SUM(clicks) clicks, SUM(impressions) imp,
           AVG(avg_impression_position) pos
    FROM bing_pages WHERE domain=?
    GROUP BY page ORDER BY imp DESC LIMIT 25
""", (domain,))
p('\n=== BING PAGES ===')
for r in cur.fetchall():
    p(r['page'], '| clicks=', r['clicks'], '| imp=', r['imp'], '| pos=', round(r['pos'],1) if r['pos'] else None)

cur.execute("""
    SELECT page, http_status, discovery_date, last_crawled_date,
           anchor_count, total_child_url_count, document_size,
           historical_clicks, historical_impressions
    FROM bing_url_info WHERE domain=?
""", (domain,))
p('\n=== BING URL INFO ===')
for r in cur.fetchall():
    p(dict(r))

cur.execute("SELECT date, SUM(clicks) clicks, SUM(impressions) imp FROM bing_traffic WHERE domain=? GROUP BY date ORDER BY date DESC LIMIT 15", (domain,))
p('\n=== BING TRAFFIC (by date) ===')
for r in cur.fetchall():
    p(r['date'], '| clicks=', r['clicks'], '| imp=', r['imp'])

cur.execute("SELECT date, SUM(pages_crawled) pages FROM bing_crawl_stats WHERE domain=? GROUP BY date ORDER BY date DESC LIMIT 15", (domain,))
p('\n=== BING CRAWL STATS ===')
for r in cur.fetchall():
    p(r['date'], '| pages_crawled=', r['pages'])

# GA4 traffic sources date range for wordlechinese
cur.execute("SELECT MIN(start_date) mn, MAX(end_date) mx FROM ga4_traffic_sources WHERE domain=?", (domain,))
r = cur.fetchone()
p('\nGA4 traffic date range:', dict(r))

# GA4 retention detail
cur.execute("SELECT cohort_week, retention_week, retained_users, total_cohort_users, retention_rate FROM ga4_retention WHERE domain=? ORDER BY cohort_week, retention_week LIMIT 20", (domain,))
p('\n=== GA4 RETENTION ===')
for r in cur.fetchall():
    p(r['cohort_week'], '| week', r['retention_week'], '| retained=', r['retained_users'], '/', r['total_cohort_users'], '=', round(r['retention_rate']*100,1) if r['retention_rate'] else None, '%')

# Page metrics date range
cur.execute("SELECT MIN(start_date) mn, MAX(end_date) mx FROM page_metrics WHERE domain=?", (domain,))
r = cur.fetchone()
p('\nGSC page_metrics date range:', dict(r))

cur.execute("SELECT MIN(start_date) mn, MAX(end_date) mx FROM search_queries WHERE domain=?", (domain,))
r = cur.fetchone()
p('GSC search_queries date range:', dict(r))

out.close()
print('done')