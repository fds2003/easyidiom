import sqlite3, sys, traceback

out = open(r'E:\code\wordlechinese\.freebuff\seo_report.txt', 'w', encoding='utf-8')

def p(*args):
    out.write(' '.join(str(a) for a in args) + '\n')

try:
    conn = sqlite3.connect(r'E:\code\gscga4fordata\output\seo_data.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    domain = 'wordlechinese.com'
    prop = 'property_537660474'

    cur.execute("""
        SELECT type, COUNT(*) cnt, SUM(impressions) imp, AVG(rank) rk
        FROM seo_opportunities WHERE domain=?
        GROUP BY type ORDER BY cnt DESC
    """, (domain,))
    p('=== SEO OPPORTUNITIES BY TYPE ===')
    for r in cur.fetchall():
        p(r['type'], '| n=', r['cnt'], '| imp=', r['imp'], '| avg_rank=', round(r['rk'],1) if r['rk'] else None)

    cur.execute("""
        SELECT type, target, impressions, rank, recommendation
        FROM seo_opportunities
        WHERE domain=? AND target NOT LIKE '%/answer/%'
        ORDER BY impressions DESC LIMIT 25
    """, (domain,))
    p('\n=== NON-ANSWER SEO OPPORTUNITIES ===')
    for r in cur.fetchall():
        p(r['type'], '| imp=', r['impressions'], '| rank=', round(r['rank'],1) if r['rank'] else None, '|', r['target'])

    cur.execute("""
        SELECT source_medium, SUM(sessions) sess, SUM(engaged_sessions) eng,
               SUM(new_users) nu, SUM(page_views) pv
        FROM ga4_traffic_sources WHERE domain=?
        GROUP BY source_medium ORDER BY sess DESC LIMIT 20
    """, (domain,))
    p('\n=== GA4 TRAFFIC SOURCES (wordlechinese.com) ===')
    for r in cur.fetchall():
        p('sess=', r['sess'], '| eng=', r['eng'], '| new=', r['nu'], '| pv=', r['pv'], '|', r['source_medium'])

    for t in ['ga4_content','ga4_events','ga4_conversions','ga4_page_performance']:
        cur.execute(f"SELECT COUNT(*) FROM {t} WHERE domain=?", (prop,))
        p(f'{t} rows for {prop}:', cur.fetchone()[0])

    for t in ['bing_pages','bing_queries','bing_url_info','bing_traffic','bing_crawl_stats']:
        cur.execute(f"SELECT DISTINCT domain FROM {t}")
        p(f'{t} domains:', [r[0] for r in cur.fetchall()])

    cur.execute("""
        SELECT platform, query, date, position, clicks, impressions
        FROM ranking_history WHERE domain=?
        ORDER BY date DESC LIMIT 30
    """, (domain,))
    p('\n=== RANKING HISTORY (wordlechinese.com, latest) ===')
    for r in cur.fetchall():
        p(r['date'], '|', r['platform'], '| pos=', round(r['position'],1), '| clicks=', r['clicks'], '| imp=', r['impressions'], '|', r['query'])

    cur.execute("""
        SELECT * FROM ranking_changes WHERE domain=?
        ORDER BY check_date DESC
    """, (domain,))
    p('\n=== RANKING CHANGES (tracked items) ===')
    for r in cur.fetchall():
        p(r['check_date'], '|', r['platform'], '|', r['query'], '|', r['change_type'], '|', r['trigger'], '| prev=', r['prev_position'], '->curr=', r['curr_position'])

    # GA4 content per property for page performance detail
    cur.execute("""
        SELECT page_path, page_title, SUM(screen_page_views) pv,
               AVG(engagement_rate) er, AVG(bounce_rate) br
        FROM ga4_page_performance WHERE domain=?
        GROUP BY page_path ORDER BY pv DESC LIMIT 30
    """, (prop,))
    p('\n=== GA4 PAGE PERFORMANCE (property) ===')
    for r in cur.fetchall():
        er = r['er'] if r['er'] is not None else 0
        br = r['br'] if r['br'] is not None else 0
        p('pv=', r['pv'], '| engaged=', round(er*100,1), '% | bounce=', round(br*100,1), '% |', r['page_path'], '|', r['page_title'])

except Exception as e:
    p('ERROR:', e)
    traceback.print_exc(file=out)

out.close()
print('done')