# Cloudflare cache purge

Simple script to purge Cloudflare cache for user avatars, cache purged when account update operations are detected on Hive blockchain.

### Env variables


`CF_ZONE` - Cloudflare zone ID for your domain

`CF_API_TOKEN` - Cloudflare API token with permission to purge cache for the zone

`CF_EMAIL` and `CF_KEY` - legacy email and global API key (used only if `CF_API_TOKEN` is not provided)

`DOMAIN` - imagehoster instance, e.g. https://images.ecency.com
