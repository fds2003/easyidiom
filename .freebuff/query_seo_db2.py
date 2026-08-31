import sqlite3

conn = sqlite3.connect(r'E:\code\gscga4fordata\output\seo_data.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
domain = 'wordlechinese.com'

# 1. SEO opportunities
cur.execute("""
    SELECT type, target, SUM(impressions) as imp, SUM(sessions) as sess,
           AVG(bounce_rate) as bounce, AVG(rank) as rk, recommendation
    FROM seo_opportunities WHERE domain=?
    GROUP BY type, target ORDER BY imp DESC LIMIT 40
""", (domain,))
print("=== SEO OPPORTUNITIES (top by impressions) ===")
for r in cur.fetchall():
    print(f"{r['type']:12s} | imp={r['imp']:6d} | sess={r['sess']:5d} | bounce={r['bounce'] if r['bounce'] is not None else 0:.0%} | rank={r['rk']:.1f} | {r['target']}")

# 2. High impression / low click pages (opportunity)
cur.execute("""
    SELECT page, SUM(gsc_impressions) imp, SUM(gsc_clicks) clicks,
           AVG(gsc_position) pos, AVG(gsc_ctr) ctr
    FROM page_metrics WHERE domain=? AND SUM_placeholder=0
    GROUP BY page HAVING SUM(gsc_impressions) > 200
    ORDER BY imp DESC
""".replace('SUM_placeholder=0', '1=1'), (domain,))
print("\n=== PAGES WITH >200 IMPRESSIONS ===")
for r in cur.fetchall():
    ctr = (r['clicks']/r['imp']*100) if r['imp'] else 0
    print(f"imp={r['imp']:6d} clicks={r['clicks']:5d} ctr={ctr:5.1f}% pos={r['pos']:5.1f} | {r['page']}")

# 3. GA4 traffic sources
cur.execute("""
    SELECT source_medium, SUM(sessions) sess, SUM(engaged_sessions) eng
    FROM ga4_traffic_sources WHERE domain=?
    GROUP BY source_medium ORDER BY sess DESC LIMIT 15
""", (domain,))
print("\n=== GA4 TRAFFIC SOURCES ===")
for r in cur.fetchall():
    print(f"{r['sess']:6d} sessions | {r['eng']:5d} engaged | {r['source_medium']}")

# 4. GA4 content breakdown
cur.execute("""
    SELECT page_path, page_title, SUM(page_views) pv, SUM(sessions) sess,
           AVG(bounce_rate) bounce
    FROM ga4_content WHERE domain=?
    GROUP BY page_path ORDER BY pv DESC LIMIT 25
""", (domain,))
print("\n=== GA4 CONTENT (by pageviews) ===")
for r in cur.fetchall():
    b = r['bounce'] if r['bounce'] is not None else 0
    print(f"pv={r['pv']:6d} | sess={r['sess']:5d} | bounce={b*100:.0f}% | {r['page_path']} | {r['page_title']}")

# 5. GA4 events
cur.execute("SELECT event_name, SUM(event_count) cnt, SUM(event_value) val FROM ga4_events WHERE domain=? GROUP BY event_name ORDER BY cnt DESC", (domain,))
print("\n=== GA4 EVENTS ===")
for r in cur.fetchall():
    print(f"{r['cnt']:8d} | {r['val']} | {r['event_name']}")

# 6. GA4 conversions
cur.execute("SELECT conversion_name, SUM(conversions) conv, channel_grouping FROM ga4_conversions WHERE domain=? GROUP BY conversion_name, channel_grouping ORDER BY conv DESC", (domain,))
print("\n=== GA4 CONVERSIONS ===")
for r in cur.fetchall():
    print(f"{r['conv']:6d} conv | {r['channel_grouping']} | {r['conversion_name']}")

# 7. GA4 page performance (engagement)
cur.execute("""
    SELECT page_path, page_title, SUM(screen_page_views) pv,
           AVG(engagement_rate) er, AVG(bounce_rate) br, SUM(event_count) ev
    FROM ga4_page_performance WHERE domain=?
    GROUP BY page_path ORDER BY pv DESC LIMIT 25
""", (domain,))
print("\n=== GA4 PAGE PERFORMANCE ===")
for r in cur.fetchall():
    er = r['er'] if r['er'] is not None else 0
    br = r['br'] if r['br'] is not None else 0
    print(f"pv={r['pv']:6d} | engaged={er*100:5.1f}% | bounce={br*100:5.1f}% | ev={r['ev']:6d} | {r['page_path']}")

# 8. GA4 retention
cur.execute("SELECT cohort_week, MAX(retention_week) maxw, retention_rate FROM ga4_retention WHERE domain=? AND retention_week=0", (domain,))
print("\n=== GA4 RETENTION (week0) ===")
for r in cur.fetchall():
    print(f"{r['cohort_week']} | rate={r['retention_rate']:.1%}")