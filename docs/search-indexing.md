# Search indexing

The homepage and published `/{alias}` cards are indexable. The app serves
`/robots.txt` and `/sitemap.xml`, adds canonical URLs and social previews, and
embeds WebSite, Organization, and ProfilePage structured data. The homepage
also links to published creators in its server-rendered HTML.

Account, authentication, dashboard, and auxiliary sponsorship form pages use
`noindex`. These pages remain crawlable so engines can read that directive.
Unpublished cards are excluded from the sitemap and public profile data.

## Production setup

1. Set `NEXT_PUBLIC_APP_URL` to the public HTTPS production origin before building.
2. Deploy and check `/robots.txt`, `/sitemap.xml`, and a published creator card.
3. Verify the domain in Google Search Console and Bing Webmaster Tools. DNS
   verification works without code changes. For HTML verification, set
   `GOOGLE_SITE_VERIFICATION` and/or `BING_SITE_VERIFICATION` to the supplied
   token and rebuild.
4. Submit `/sitemap.xml` in each service and request indexing for the homepage.

The sitemap reads current published cards and their actual `updated_at` dates,
paging through Supabase results. Storage errors fail the sitemap request rather
than returning a misleading partial list. Split into sitemap shards before
reaching the protocol limit of 50,000 URLs.

Indexing and rankings are controlled by search engines; publishing these
changes makes the pages discoverable but does not guarantee a ranking or an
immediate appearance in results.
