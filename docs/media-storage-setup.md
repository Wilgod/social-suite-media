# Media storage setup

Social Suite stores uploaded images/videos in any S3-compatible object storage bucket, configured via five environment variables:

```
STORAGE_ENDPOINT=
STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_PUBLIC_BASE_URL=
```

Until these are set, the Media page (`/dashboard/media`) shows a "not configured" notice instead of an upload button.

## Pricing: Cloudflare R2 vs AWS S3

**Recommendation: Cloudflare R2.** Media you post gets fetched a lot (by viewers, by platform APIs when publishing) — S3 charges for every GB that leaves the bucket ("egress"), R2 charges $0 egress at any volume. For an app like this, egress is where S3 costs quietly add up.

| | Cloudflare R2 | AWS S3 (Standard, us-east-1) |
|---|---|---|
| Storage | $0.015/GB/month | $0.023/GB/month (first 50TB) |
| Free tier | 10GB storage, 1M write ops, 10M read ops — per month, ongoing | 100GB egress/month free (aggregate across AWS, first 12 months only) |
| Egress (data out) | **$0** at any volume | $0.09/GB after the first 100GB/month |
| Write requests | $4.50 per million | ~$0.005 per 1,000 (≈ $5/million) |
| Read requests | $0.36 per million | ~$0.0004 per 1,000 (≈ $0.40/million) |

For a small/early-stage app, realistic monthly cost on R2 is **$0** until you exceed 10GB stored — and stays low afterward since there's no egress bill. Verify current numbers before relying on them: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) · [AWS S3 pricing](https://aws.amazon.com/s3/pricing/).

## Step-by-step: Cloudflare R2

1. **Sign up / log in** at [dash.cloudflare.com](https://dash.cloudflare.com).
2. In the left sidebar, go to **R2 Object Storage**. First time here, Cloudflare asks you to add a payment method even to use the free tier — you won't be charged unless you exceed it.
3. Click **Create bucket**. Name it (e.g. `social-suite-media`), pick a location hint close to your users, leave default storage class as **Standard**.
4. **Enable public access** for the bucket so uploaded media has a URL viewers/platforms can fetch:
   - Open the bucket → **Settings** → **Public access**.
   - Quickest for development: enable the **R2.dev subdomain**. You'll get a URL like `https://pub-xxxxxxxx.r2.dev`.
   - For production, connect a **custom domain** instead (same section) — r2.dev subdomains are rate-limited and not meant for production traffic.
5. **Create API credentials** scoped to this bucket:
   - Go back to the R2 overview page → **Manage API Tokens** → **Create API Token**.
   - Permissions: **Object Read & Write**.
   - Scope it to the specific bucket you just created (not "all buckets") — least-privilege.
   - Create it. Cloudflare shows you, once, an **Access Key ID**, a **Secret Access Key**, and a **Jurisdiction-specific endpoint** URL that looks like `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. Copy all three now — the secret is not shown again.
6. **Fill in `.env`**:
   ```
   STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   STORAGE_BUCKET=social-suite-media
   STORAGE_ACCESS_KEY_ID=<the access key id from step 5>
   STORAGE_SECRET_ACCESS_KEY=<the secret access key from step 5>
   STORAGE_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev
   ```
   (`STORAGE_PUBLIC_BASE_URL` is whatever public URL you set up in step 4 — the r2.dev subdomain or your custom domain, no trailing slash.)
7. **Restart the app** (`npm run dev:web`) — env vars are only read at process startup.
8. Go to `/dashboard/media` and try uploading a file. If it fails, double check the endpoint URL and that the API token's bucket scope matches `STORAGE_BUCKET` exactly.

## Alternative: AWS S3

1. In the AWS Console, go to **S3** → **Create bucket**. Name it, pick a region, leave "Block all public access" **off** only if you intend the bucket itself to be public — otherwise keep it blocked and serve media through CloudFront instead (more setup, not covered here).
2. Add a bucket policy or CloudFront distribution to make objects publicly readable, and note that resulting public URL for `STORAGE_PUBLIC_BASE_URL`.
3. Go to **IAM** → **Users** → create a user with **programmatic access** and an inline policy granting `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` scoped to `arn:aws:s3:::<your-bucket>/*`.
4. Create an access key for that user → copy the **Access Key ID** and **Secret Access Key**.
5. Fill in `.env`:
   ```
   STORAGE_ENDPOINT=https://s3.<region>.amazonaws.com
   STORAGE_BUCKET=<your-bucket-name>
   STORAGE_ACCESS_KEY_ID=<access key id>
   STORAGE_SECRET_ACCESS_KEY=<secret access key>
   STORAGE_PUBLIC_BASE_URL=<your public bucket or CloudFront URL>
   ```
6. Restart the app.
