import sqlite3

db_path = 'E:/code/gscga4fordata/output/seo_data.db'
conn = sqlite3.connect(db_path)
c = conn.cursor()

print("=== CORE WEB VITALS (easyidiom.com) ===")
c.execute("SELECT page_url, strategy, performance_score, cwv_status, lcp_ms, fcp_ms, cls_score, tbt_ms, ttfb_ms FROM core_web_vitals WHERE domain='easyidiom.com'")
for r in c.fetchall():
    print(r)

print("\n=== SEARCH QUERIES (easyidiom.com, top 20 by impressions) ===")
c.execute("SELECT query, clicks, impressions, ctr, position FROM search_queries WHERE domain='easyidiom.com' ORDER BY impressions DESC LIMIT 20")
for r in c.fetchall():
    print(r)

print("\n=== PAGE METRICS (easyidiom.com, top 20 by impressions) ===")
c.execute("SELECT page, gsc_clicks, gsc_impressions, gsc_ctr, gsc_position, ga4_sessions, ga4_users FROM page_metrics WHERE domain='easyidiom.com' ORDER BY gsc_impressions DESC LIMIT 20")
for r in c.fetchall():
    print(r)

print("\n=== SEO OPPORTUNITIES (easyidiom.com) ===")
c.execute("SELECT type, target, impressions, rank, recommendation FROM seo_opportunities WHERE domain='easyidiom.com' ORDER BY impressions DESC LIMIT 20")
for r in c.fetchall():
    print(r)

print("\n=== PERFORMANCE AUDITS (easyidiom.com) ===")
c.execute("SELECT audit_id, title, display_value, score FROM performance_audits WHERE domain='easyidiom.com' ORDER BY score ASC LIMIT 15")
for r in c.fetchall():
    print(r)

print("\n=== GA4 CONTENT (easyidiom.com) ===")
c.execute("SELECT page_path, page_title, page_views, sessions, bounce_rate, avg_session_duration, engagement_rate FROM ga4_content WHERE domain LIKE '%552176581%' ORDER BY page_views DESC LIMIT 10")
for r in c.fetchall():
    print(r)

print("\n=== GA4 TRAFFIC SOURCES (easyidiom.com) ===")
c.execute("SELECT page_path, source_medium, sessions, active_users, page_views FROM ga4_traffic_sources WHERE domain LIKE '%552176581%' ORDER BY sessions DESC LIMIT 15")
for r in c.fetchall():
    print(r)

conn.close()
