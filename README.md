EMRE

# SMTP Validator API

**v0.1 (MVP 1)** · Kendi yazdığımız, DNS/MX seviyesinde çalışan bir **email
doğrulama ve risk analizi REST API'si**.

Bu API'nin amacı sadece _"email var mı, yok mu"_ demek **değildir**. Amaç, bir
email adresinin **teknik geçerliliğini**, **domain/MX durumunu**, **risk
seviyesini** ve **gönderim uygunluğunu** analiz edip tek bir yapılandırılmış
sonuçta özetlemektir. Böylece bir adresi gönderim listesine almadan önce; formatı
bozuk mu, domain gerçekten mail alıyor mu, tek kullanımlık/rol tabanlı bir adres
mi, popüler bir sağlayıcının yazım hatası mı ve ne kadar riskli — hepsini tek
çağrıda görürsün.

Bu depo projenin **MVP 1** aşamasıdır: verilen adresi normalize eder, syntax /
domain / DNS / MX kontrollerinden geçirir, disposable ve role-based tespiti
yapar, yazım hatası (typo) önerisi üretir, 0–100 risk skoru hesaplar ve sonucu
PostgreSQL'e kaydeder.

> ℹ️ **SMTP Probe Desteği (Sinyal)**
> Bu sürüm, isteğe bağlı olarak gerçek bir SMTP bağlantısı (EHLO / MAIL FROM / RCPT TO)
> kurarak mailbox yanıtını bir **sinyal** olarak değerlendirir. Ancak anti-spam
> politikaları nedeniyle SMTP yanıtları (örn. timeout, greylisting) tek başına kesin
> doğrulama kabul edilmez, risk skoruna etki eder.

Hazır email doğrulama servisleri (ZeroBounce, NeverBounce, Bouncer, Kickbox,
Hunter, AbstractAPI, MailboxLayer vb.) **kullanılmaz** — tüm mantık bu depoda
yazılıdır.

---

## Bu MVP'de olan özellikler

- Email normalize (trim, görünmez karakter temizleme, lowercase)
- Syntax kontrolü (pragmatik, aşırı katı değil)
- Domain parse (localPart, domain, TLD, subdomain, free/corporate)
- DNS kontrolü (`resolveMx`, `resolve4`, `resolve6`) — timeout korumalı
- MX kaydı kontrolü ve priority sıralaması
- Null MX (RFC 7505) kontrolü
- Disposable domain kontrolü (DB + gömülü liste)
- Role-based email kontrolü (DB + gömülü liste)
- Typo/"did you mean" önerisi (Levenshtein mesafesi)
- İsteğe bağlı SMTP probing (mailbox doğrulaması sinyali)
- 0–100 risk skoru ve risk seviyesi
- Sonuçların PostgreSQL'e kaydı (Prisma)
- Swagger / OpenAPI dokümantasyonu
- Basit `x-api-key` header auth
- Jest testleri
- Docker Compose ile PostgreSQL

## Bu MVP'de OLMAYAN özellikler (sonraki aşamalar)

- Catch-all tespiti
- Redis, BullMQ, bulk validation
- Domain bazlı concurrency, SMTP timeout/retry
- API kullanıcı / kredi sistemi
- Frontend panel

---

## Teknolojiler

NestJS · TypeScript · PostgreSQL · Prisma · @nestjs/config ·
class-validator/-transformer · Node `dns.promises` · Swagger · Jest · Docker

---

## Klasör Yapısı

```text
src/
├── app.module.ts
├── main.ts
├── config/                # app.config.ts, database.config.ts
├── common/
│   ├── constants/         # disposable / role / free / reference listeleri
│   ├── enums/             # email-status, email-sub-status, risk-level
│   ├── types/             # validation.types.ts
│   ├── guards/            # api-key.guard.ts
│   └── filters/           # all-exceptions.filter.ts
├── prisma/                # prisma.service.ts, prisma.module.ts
├── health/                # health.module.ts, health.controller.ts
└── validation/
    ├── validation.module.ts
    ├── validation.controller.ts
    ├── validation.service.ts        # orchestrator
    ├── dto/
    ├── repositories/
    └── services/                    # 11 tekil kontrol servisi
prisma/
├── schema.prisma
└── seed.ts
docker-compose.yml
```

---

## Kurulum

Gereksinimler: **Node.js 20+**, **Docker**.

```bash
# 1) Bağımlılıklar
npm install

# 2) Ortam dosyası
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

### Docker ile PostgreSQL çalıştırma

```bash
docker compose up -d
# durumu kontrol et:
docker compose ps
```

PostgreSQL `localhost:5432` üzerinde açılır
(kullanıcı/şifre/db: `smtp_validator` / `smtp_validator` / `smtp_validator_db`).

### Migration çalıştırma

```bash
npm run prisma:generate    # Prisma client üret
npm run prisma:migrate     # şemayı DB'ye uygula (ilkinde ad sorar: örn. "init")
```

### Seed çalıştırma

```bash
npm run prisma:seed        # disposable domain + role-based prefix listelerini ekler
```

### API'yi başlatma

```bash
npm run start:dev          # watch modunda
# veya
npm run build && npm run start:prod
```

Uygulama açıldığında:

```text
API:     http://localhost:3000
Swagger: http://localhost:3000/docs
```

### Docker image ile çalıştırma (opsiyonel)

Depoda çok aşamalı bir `Dockerfile` bulunur. API'yi container olarak çalıştırmak
istersen:

```bash
docker build -t smtp-validator-api .
docker run --rm -p 3000:3000 --env-file .env smtp-validator-api
```

Container başlarken `prisma migrate deploy` çalıştırır, ardından API'yi başlatır.
`DATABASE_URL` container'dan erişilebilir bir PostgreSQL'i göstermelidir (aynı
Docker network'ünde çalışıyorsan `localhost` yerine servis adını kullan).

---

## Swagger kullanımı

`http://localhost:3000/docs` adresini aç. Sağ üstteki **Authorize** butonuna
tıklayıp `x-api-key` değerini gir (varsayılan: `development-key`). Ardından
endpointleri doğrudan Swagger üzerinden test edebilirsin.

Görünen endpointler:

```text
GET  /health
POST /api/validate/single
GET  /api/validate/history
GET  /api/validate/history/:id
```

> Not: `/health` ve `/docs` public'tir; `/api/validate/*` uçları `x-api-key`
> ister. Yanlış/eksik key -> **401**.

---

## Tekli email validation örnekleri

```bash
# Geçerli, kurumsal görünen adres
curl -X POST http://localhost:3000/api/validate/single \
  -H "Content-Type: application/json" \
  -H "x-api-key: development-key" \
  -d '{"email":"user@example.com"}'

# Typo örneği -> didYouMean döner
curl -X POST http://localhost:3000/api/validate/single \
  -H "Content-Type: application/json" -H "x-api-key: development-key" \
  -d '{"email":"user@gmial.com"}'

# Disposable
curl -X POST http://localhost:3000/api/validate/single \
  -H "Content-Type: application/json" -H "x-api-key: development-key" \
  -d '{"email":"test@mailinator.com"}'

# Geçmiş
curl http://localhost:3000/api/validate/history -H "x-api-key: development-key"
curl http://localhost:3000/api/validate/history/<id> -H "x-api-key: development-key"
```

Örnek başarılı yanıt:

```json
{
  "id": "…uuid…",
  "email": "user@example.com",
  "normalizedEmail": "user@example.com",
  "localPart": "user",
  "domain": "example.com",
  "status": "deliverable",
  "subStatus": "mx_found",
  "risk": "VERY_LOW",
  "score": 100,
  "checks": {
    "syntaxValid": true,
    "domainValid": true,
    "dnsFound": true,
    "mxFound": true,
    "nullMx": false,
    "disposable": false,
    "roleBased": false,
    "freeEmail": false,
    "typoDetected": false,
    "smtp": {
      "status": "accepted",
      "code": 250,
      "enhancedCode": "2.1.5",
      "message": "OK",
      "provider": "corporate",
      "mxHost": "mx.example.com",
      "durationMs": 120
    }
  },
  "dns": { "mxRecords": [{ "exchange": "…", "priority": 10 }], "aRecords": [], "aaaaRecords": [] },
  "suggestion": { "didYouMean": null },
  "reason": "Email passed syntax and DNS/MX checks. SMTP mailbox verification has not been performed in this MVP.",
  "checkedAt": "2026-07-01T12:00:00.000Z"
}
```

### Response alanları

| Alan                 | Tip              | Açıklama |
| -------------------- | ---------------- | -------- |
| `id`                 | string (uuid)    | Kaydın kimliği; `GET /history/:id` için kullanılır. |
| `email`              | string           | İstemcinin gönderdiği ham adres. |
| `normalizedEmail`    | string           | Trim + görünmez karakter temizliği + lowercase sonucu. |
| `localPart`          | string \| null   | `@` öncesi (syntax geçersizse `null`). |
| `domain`             | string \| null   | `@` sonrası (syntax geçersizse `null`). |
| `status`             | enum             | Ana sonuç — tabloya bkz. |
| `subStatus`          | enum \| null     | İnce sebep — tabloya bkz. |
| `risk`               | enum             | `very_low` / `low` / `medium` / `high`. |
| `score`              | number (0–100)   | Risk skoru; skordan risk seviyesi türetilir. |
| `checks`             | object           | Tüm kontrollerin boolean özeti (aşağıdaki alanlar). |
| `checks.syntaxValid` | boolean          | Format kontrolü geçti mi. |
| `checks.domainValid` | boolean          | Domain ayrıştırılabildi mi. |
| `checks.dnsFound`    | boolean          | Herhangi bir DNS kaydı (MX/A/AAAA) bulundu mu. |
| `checks.mxFound`     | boolean          | Kullanılabilir MX kaydı var mı. |
| `checks.nullMx`      | boolean          | Domain açıkça mail reddediyor mu (RFC 7505). |
| `checks.disposable`  | boolean          | Tek kullanımlık sağlayıcı mı. |
| `checks.roleBased`   | boolean          | Rol tabanlı adres mi (info@, support@ …). |
| `checks.freeEmail`   | boolean          | Ücretsiz sağlayıcı mı (gmail, hotmail …). |
| `checks.typoDetected`| boolean          | Yazım hatası tespit edildi mi. |
| `dns.mxRecords`      | `{exchange,priority}[]` | Priority'ye göre artan sıralı MX kayıtları. |
| `dns.aRecords`       | string[]         | A (IPv4) kayıtları. |
| `dns.aaaaRecords`    | string[]         | AAAA (IPv6) kayıtları. |
| `suggestion.didYouMean` | string \| null | Yazım hatasında önerilen tam adres, yoksa `null`. |
| `reason`             | string           | İnsan tarafından okunabilir açıklama. |
| `checkedAt`          | string (ISO-8601)| Kaydın oluşturulma zamanı. |

> `GET /api/validate/history` bu nesnenin **özet** halini döner:
> `id`, `email`, `status`, `subStatus`, `risk`, `score`, `checkedAt`.

---

## Status açıklamaları

| status          | anlamı |
| --------------- | ------ |
| `deliverable`   | Temel kontrollerden geçti, DNS/MX açısından gönderilebilir görünüyor. |
| `undeliverable` | Temel bir kontrolde başarısız (syntax, DNS, MX, null MX, typo). |
| `risky`         | Teknik olarak mümkün ama riskli (ör. role-based). |
| `unknown`       | Kesin karar verilemedi (ör. DNS timeout/hata). |
| `do_not_mail`   | Bu adrese mail gönderilmemeli (ör. disposable). |

## Sub status açıklamaları

| subStatus              | anlamı |
| ---------------------- | ------ |
| `failed_syntax_check`  | Email formatı geçersiz. |
| `invalid_domain_format`| Domain formatı geçersiz. |
| `no_dns_entries`       | Domain'in hiç DNS kaydı yok. |
| `no_mx_records`        | DNS var ama MX kaydı yok. |
| `null_mx`              | Domain açıkça mail kabul etmiyor (RFC 7505). |
| `mx_found`             | Kullanılabilir MX kaydı bulundu. |
| `disposable`           | Tek kullanımlık / geçici email sağlayıcısı. |
| `role_based`           | Kişiye değil role ait adres (info@, support@ …). |
| `possible_typo`        | Popüler bir sağlayıcının yazım hatası gibi görünüyor. |
| `free_email`           | Ücretsiz sağlayıcı (gmail, hotmail …). |
| `corporate_email`      | Kurumsal domain. |
| `unknown_error`        | DNS hatası/timeout — kesin karar verilemedi. |

## Risk skoru ve seviyesi

```text
0-30   -> high
31-60  -> medium
61-84  -> low
85-100 -> very_low
```

Kontrol öncelik sırası (en kritik önce):

```text
syntax invalid > disposable > dns error/timeout > no DNS > null MX >
no MX > possible typo > role-based > mx found (deliverable)
```

## SMTP Validation and Signal-Based Approach

SMTP Probing is integrated but specifically designed **not** to be the ultimate source of truth. Due to aggressive anti-spam measures, an SMTP failure doesn't guarantee the mailbox doesn't exist. By default, SMTP validation is disabled in development (controlled by `SMTP_ENABLED` in `.env`). When enabled, it performs a lightweight connection test (namespace mining is avoided):

1. **Provider Detection**: The MX host is analyzed to determine the email provider (e.g., `gmail`, `outlook`, `microsoft_365`, `yahoo`, `enterprise_gateway`, `corporate`) and its `providerRiskProfile` (`strict`, `moderate`, `relaxed`).
2. **SMTP Probe**: Connects to the primary MX server, negotiates EHLO, and tests `RCPT TO` without actually sending an email.
3. **Risk Scoring**:
   - `accepted` on a `corporate` provider: Treated as `risky` (Possible Catch-All).
   - `rejected` on a `strict` provider (e.g., Gmail, Outlook): Final status is `undeliverable` (Score becomes 0).
   - `timeout` or `connection_failed` on an `enterprise_gateway`: Handled gracefully as `unknown` with `tarpit_suspected` subStatus to prevent false negatives.
   - `tempfail` on `gmail`/`outlook`: Penalized less (-10 instead of -20) as it is often a temporary IP reputation issue.
   - `blocked`: Reduced score, marked as `risky`.
   - `tempfails (4xx)` on other providers: Lowers the score mildly but does not mark the email as `invalid`.

This check can be enabled via `SMTP_VALIDATION_ENABLED=true` in the `.env` file.

## Queue & Rate Limiting (Concurrency & Cooldown)
To protect IP reputation and prevent being flagged for namespace mining, the SMTP module uses a robust in-memory queue and rate limiting system:
- **Global Concurrency**: Limits the total number of simultaneous SMTP probes (default: 10).
- **Provider & Domain Concurrency**: Strict concurrency controls limit requests based on the MX provider (e.g., 1 for Gmail, Outlook, Yahoo) and target domain (e.g., 1 per domain).
- **Retry Policy**: 
  - Transient errors (`tempfail`, `timeout`, `connection_failed`) are retried (default max 1 retry with exponential backoff).
  - Definitive results (`accepted`, `rejected`) and policy blocks (`blocked`) are **never** retried.
- **Cooldown Mechanism**: If an enterprise gateway or strict provider rate-limits/blocks the probe (`blocked`), the provider and domain are immediately placed in a "cooldown" period. New requests to this destination are skipped gracefully until the cooldown expires to protect IP health.

Environment configuration:
```env
SMTP_DOMAIN_CONCURRENCY=1
SMTP_PROVIDER_CONCURRENCY_DEFAULT=2
SMTP_PROVIDER_CONCURRENCY_GMAIL=1
SMTP_MAX_RETRIES=1
SMTP_RETRY_BACKOFF_MS=30000
SMTP_PROVIDER_COOLDOWN_MS=60000
```

## Catch-All Domain Detection
Some domains accept any email address sent to them (Catch-All). When a domain behaves this way, an SMTP `accepted` (250) response is **not proof** that a specific mailbox exists. 

To mitigate this, the API runs an active Catch-All check if the target email receives an `accepted` response:
1. It generates a random, high-entropy address (e.g., `verify-8f92a1c3@example.com`).
2. It enqueues an SMTP probe for this random address using the rate-limiting queue.
3. If the random address is `accepted`, the domain is flagged as `Catch-All detected`. The final risk score is capped at 60, and the status becomes `risky`.
4. If the random address is `rejected`, the target email is confirmed as not just a catch-all but an actually existing mailbox, adding confidence (score bonus).
5. For some providers (like Gmail, Outlook, Yahoo) where catch-all checks are known to trigger spam filters or they don't use catch-alls, the check is explicitly skipped.

Configured via:
```env
SMTP_CATCH_ALL_CHECK_ENABLED=false
SMTP_CATCH_ALL_RANDOM_PREFIX=verify
SMTP_CATCH_ALL_TIMEOUT_MS=8000
SMTP_CATCH_ALL_SKIP_PROVIDERS=gmail,outlook,yahoo
```

## Domain Behavior Cache
To avoid redundant probes (e.g. repeatedly hitting a domain that always tempfails or tarpits) and to remember domains that are verified catch-alls, the API uses a Domain Behavior Cache.

1. **Catch-All Memory**: If a domain is identified as a catch-all, subsequent requests to that domain will immediately be flagged as risky (Possible Catch-All) without executing another random-prefix test.
2. **Timeout/Tempfail Rates**: A moving average (EWMA) tracks failure rates for each domain. If a domain has a history of high tempfails or timeouts (>50%), the overall score is lowered, and its behavior is reported as `lowered` confidence.
3. **Block Cooldowns**: If a provider triggers a policy block, the domain is placed in a cooldown period (e.g., 5 minutes) during which all SMTP tests are skipped to protect the server's IP reputation.

Configured via:
```env
DOMAIN_BEHAVIOR_CACHE_ENABLED=true
DOMAIN_BEHAVIOR_CACHE_TTL_MS=86400000
DOMAIN_BEHAVIOR_MIN_SAMPLE_SIZE=3
```

## Bounce Feedback System (Reputation Loop)
SMTP doğrulamasının ötesinde, gerçek e-posta gönderim verilerinden (Delivery, Hard Bounce, vb.) öğrenen kapalı devre bir geri bildirim sistemi eklendi.

### Nasıl Çalışır?
1. E-posta sağlayıcınızdan (SendGrid, Mailgun, Amazon SES vb.) dönen etkinlikleri (webhooks) API'mize beslersiniz.
2. API bu geçmişi saklar ve bir **Reputation Score** çıkarır.
3. `ValidationService`, bir e-postayı analiz ederken ilk olarak geçmişine bakar:
   - **Hard Bounce varsa:** Anında `undeliverable` (skor 0) döner. Gereksiz DNS/SMTP sorgusu yapılmaz.
   - **Başarılı Gönderim (Delivered) varsa:** Adresin güven skoru ve `confidence` (güven düzeyi) artırılır.
   - **Şikayet (Complaint) veya Soft Bounce varsa:** Risk skoru düşürülerek dikkatli olunması uyarısı verilir.

### API Kullanımı

**Event Göndermek İçin (Örn: Webhook'tan):**
```bash
curl -X POST http://localhost:3000/api/bounce-events \
  -H "Content-Type: application/json" \
  -H "x-api-key: development-key" \
  -d '{
    "email": "user@example.com",
    "eventType": "hard_bounce",
    "smtpCode": "550",
    "enhancedCode": "5.1.1",
    "reason": "user_not_found",
    "occurredAt": "2026-07-01T15:00:00Z"
  }'
```

**Reputation / Geçmişi Görmek İçin:**
```bash
curl http://localhost:3000/api/email-history/user@example.com -H "x-api-key: development-key"
```

> **Not:** MVP aşamasında bu modül (10,000 kayıt limitli) bir RAM belleği kullanır. Production'a alırken bu modülü kalıcı bir veritabanına bağlamanız gerekir.

## Dataset Schema Validation

Dataset yüklenirken otomatik schema validation çalışır. Kontrol edilen kurallar:
- Geçerli email formatı (Syntax hatası beklenenler hariç)
- Zorunlu alanlar (`email`, `expectedStatus`, `category`, `providerClass`, `groundTruthMethod`)
- Geçerli enum değerleri
- Tekil (unique) email kontrolü

Geçersiz veri varsa rapor vermez, detaylı hata listesi sunar (max 20 hata ekrana basılır).

## Final Quality Report (SMTP Validation Quality)

SMTP validasyonu ve IP kalitesinin etkisini ölçmek için benchmark raporlarını analiz edip **kesin bir ürün kararı** çıkartan "Final Report Generator" aracını kullanabilirsiniz.

```bash
# Farklı benchmark çıktılarını birleştirip analiz eder
npm run report:smtp-quality -- --runs baseline-no-smtp,cheap-dc-ip-run,clean-dedicated-ip-run --markdown
```

### Rapor Nasıl Yorumlanmalı?
1. **SMTP Disabled vs. Enabled:** Sadece DNS/MX seviyesinde yapılan kontrol ile SMTP probing eklenmiş kontrol arasındaki `accuracy` farkını gösterir.
2. **IP Tier Comparison:** Ucuz/paylaşımlı IP'ler ile yüksek kaliteli özel (dedicated) IP'lerin performansını ölçer. 
   - Eğer ucuz IP'lerde **Unknown Rate** > 30% ise ve Blocked/Timeout oranları yüksekse, SMTP validasyonunun mevcut altyapıda **güvenilir olmadığını** kanıtlar.
3. **Conclusion:** Elde edilen veriler ışığında, "Bize iyi bir IP yatırımı gerekiyor mu?" (`ipInvestmentRequiredForProduction`) sorusuna `true/false` olarak kesin bir yanıt verir.

### Dataset Kategorileri

| Kategori | expectedStatus | Açıklama |
| --- | --- | --- |
| `syntax_invalid` | `invalid` | Format olarak geçersiz adresler (`@` eksik, çift `@`, boşluk vb.) |
| `invalid_domain` | `invalid` | DNS'te hiç çözülemeyen, var olmayan domainler |
| `null_mx` | `invalid` | RFC 7505 null MX yayınlayan, mail kabul etmeyen domainler |
| `no_mx` | `invalid` | A kaydı var ama MX kaydı olmayan domainler |
| `disposable` | `disposable` | Bilinen tek kullanımlık/geçici email sağlayıcıları |
| `role_based` | `role_based` | Kişiye değil role ait adresler (`info@`, `support@`, `admin@` vb.) |
| `typo` | `invalid` | Popüler sağlayıcıların yazım hataları (`gmial.com`, `hotmial.com`) |
| `owned_valid` | `valid` | Kontrol ettiğin domainde var olan, mail alan gerçek mailbox |
| `owned_invalid` | `invalid` | Kontrol ettiğin domainde mailbox'ı olmayan adresler |
| `owned_catch_all` | `catch_all` | Catch-all açık domainde herhangi bir adres |
| `provider_gmail_owned` | `valid` | Kontrol ettiğin kendi Gmail hesapların |
| `provider_outlook_owned` | `valid` | Kontrol ettiğin kendi Outlook hesapların |
| `corporate_controlled` | `valid` | Kontrol ettiğin kurumsal domain (Google Workspace / M365) |

### Controlled Pilot Dataset Nasıl Hazırlanır?

`benchmark/datasets/pilot.example.json` dosyası **placeholder** veriler içerir.
Gerçek benchmark çalıştırmak için bu dosyayı kopyalayıp kendi domainlerinle
değiştirmen gerekir:

```bash
# 3) Benchmark'ı kendi dataset'inle çalıştır
npm run benchmark -- --dataset benchmark/datasets/pilot.json --label baseline-no-smtp
```

**IP Quality Experiment (A/B Testing)**
Aynı dataset'i farklı IP altyapılarında (cheap datacenter vs. clean dedicated) test ederek IP kalitesinin validasyon üzerindeki etkisini (timeout, tempfail, bloklanma oranları) ölçebilirsiniz.

1. Testleri farklı IP tier etiketleriyle çalıştırın:
```bash
npm run benchmark -- --dataset benchmark/datasets/pilot.json --label cheap-dc-ip --ip-tier cheap_datacenter_ip
npm run benchmark -- --dataset benchmark/datasets/pilot.json --label clean-dedicated-ip --ip-tier clean_dedicated_ip
```

2. Raporları karşılaştırın:
```bash
npm run benchmark:compare -- --runs cheap-dc-ip,clean-dedicated-ip
```

Çıktı size farklı IP altyapılarındaki timeout ve unknown oranlarının karşılaştırmalı sonucunu verecektir.

> ⚠️ **Önemli:** `pilot.example.json` dosyasındaki `.example` domainleri RFC 2606
> reserved domainlerdir ve gerçek DNS sorgularında çözülmez. Gerçek test için
> **kendi kontrol ettiğin domainlerle** değiştir. Üçüncü parti domainlere SMTP
> probing yapmak provider tarafından **namespace mining / directory harvesting**
> olarak algılanabilir.

#### Gerçek Pilot İçin Domain Kurulumu

Tek bir ana domain alıp alt domainlerle tüm test senaryolarını yönetebilirsin:

```text
smtpbench.senindomain.com           (ana benchmark domaini)
├── valid.smtpbench.senindomain.com      MX → çalışan mail sunucusu, mailbox'lar oluştur
├── invalid.smtpbench.senindomain.com    MX → aynı sunucu, mailbox oluşturma
├── catchall.smtpbench.senindomain.com   MX → catch-all etkin sunucu
├── nullmx.smtpbench.senindomain.com     MX: `. 0` (RFC 7505 null MX)
└── nomx.smtpbench.senindomain.com       Sadece A kaydı, MX kaydı yok
```

| Amaç | Domain | DNS Ayarı | Notlar |
| --- | --- | --- | --- |
| **Controlled valid** | `valid.smtpbench.*` | MX → çalışan SMTP sunucusu | Gerçek mailbox'lar oluştur |
| **Controlled invalid** | `invalid.smtpbench.*` | MX → aynı sunucu | Mailbox oluşturma, RCPT TO reject etsin |
| **Catch-all** | `catchall.smtpbench.*` | MX → catch-all etkin | Tüm adresleri kabul eden sunucu |
| **Null MX** | `nullmx.smtpbench.*` | `MX 0 .` | RFC 7505: mail kabul etmiyor |
| **No MX** | `nomx.smtpbench.*` | Sadece `A` kaydı | Hiç MX kaydı yok |
| **Gmail owned** | `your-account@gmail.com` | — | 1–5 adet kendi Gmail hesabın |
| **Outlook owned** | `your-account@outlook.com` | — | 1–5 adet kendi Outlook hesabın |
| **Corporate test** | `corp.smtpbench.*` | MX → Google Workspace / M365 | Kurumsal mail (opsiyonel) |

Domainleri kurduktan sonra `pilot.json` dosyasındaki `.example` adreslerini
gerçek adreslerle değiştir ve `groundTruthMethod` alanını uygun şekilde güncelle:

- Mailbox'ı olan adresler → `owned_mailbox`
- Mailbox'ı olmayan adresler → `controlled_invalid_mailbox`
- DNS sonucuna dayanan kararlar → `dns_result`
- Elle doğrulanan bilgiler → `manual`

---

## Production / Experiment: Clean Dedicated IP Setup Checklist

SMTP validasyon kalitesi **sadece kod ile ilgili değildir**. IP itibarınız (reputation), ters DNS (PTR/rDNS) kayıtlarınız, forward-confirmed reverse DNS uyumunuz, ASN itibarınız ve sunucunuzun HELO/EHLO tutarlılığı; alınan yanıtları (timeout, tempfail, blocked) **doğrudan** etkiler.

Kaliteli bir IP olmadan SMTP validasyonunun başarı oranı dramatik şekilde düşer. Production ortamına geçmeden veya büyük çaplı IP tier experiment'leri yapmadan önce aşağıdaki teknik checklist'i uyguladığınızdan emin olun.

### 1. IP Tipi ve Altyapı
- [ ] **Dynamic / Residential IP Kullanılmamalı**: Statik bir IP kullanılmalıdır. Dinamik IP'ler ve konut (residential) IP blokları (PBL), Gmail ve Outlook gibi sağlayıcılar tarafından doğrudan bloklanır veya tarpit'e (gecikme) alınır.
- [ ] **Static Dedicated IP Önerisi**: Test ve production için en az "Clean Dedicated IP" sınıfında, daha önce spam aktivitelerinde kullanılmamış temiz bir statik sunucu IP'si kullanılmalıdır.
- [ ] **ASN (Otonom Sistem Numarası) İtibarı**: Çok ucuz (cheap datacenter) sağlayıcıların ASN'leri kara listede olabilir. Sağlayıcı seçimine dikkat edin.

### 2. DNS Ayarları (FCRDNS Uyumlu)
- [ ] **A Kaydı**: IP adresiniz için forward DNS (A kaydı) oluşturun.
- [ ] **PTR / rDNS Kaydı**: Hosting/IP sağlayıcınız üzerinden IP adresinizin ters DNS (PTR) kaydını A kaydındaki domaine yönlendirin.
- [ ] **Forward-Confirmed Reverse DNS (FCRDNS)**: A kaydı IP'yi, PTR kaydı da o domaini işaret etmelidir. Bu uyum olmazsa Outlook ve Gmail bağlantıyı tempfail (4xx) veya policy block (5xx) ile reddeder.
- [ ] **Validator Domain Önerisi**: Rastgele veya gizli domainler yerine ne iş yaptığınızı belli eden şeffaf domainler kullanın (ör. `mail.validator.example.com`).

### 3. Hostname Örneği
Sistemde kullanılacak tutarlı bir hostname kurgusu:
- **EHLO/HELO Hostname**: `mail.validator.example.com`
- **MAIL FROM (Probe) Adresi**: `probe@validator.example.com` veya `verify@validator.example.com`

### 4. Email Authentication (Kimlik Doğrulama)
- [ ] **SPF (Sender Policy Framework)**: `v=spf1 ip4:1.2.3.4 -all`
- [ ] **DKIM (DomainKeys Identified Mail)**: İmzalama yapılmasa bile public anahtarı tanımlı tutmak itibarı destekler.
- [ ] **DMARC (Domain-based Message Authentication, Reporting, and Conformance)**: `v=DMARC1; p=reject;`
> ⚠️ **Not**: Bu kayıtlar *validation-only SMTP probing* işleminde mailbox doğrulama sonucunu direkt etkilemez, ancak **sender identity ve IP reputation** oluşturmak için çok önemlidir. Çoğu strict provider, SPF/DMARC olmayan bağlantıların güvenilirliğini düşük tutar.

### 5. SMTP Client Hygiene (Bağlantı Hijyeni)
Kod tarafında zaten uygulanmış olan ama dikkat edilmesi gereken hijyen kuralları:
- [ ] **Low Concurrency**: Aynı domaine ve aynı provider'a (örn. Gmail) düşük eşzamanlı (concurrency) bağlantı yapılmalı (örn. max 1).
- [ ] **No Pipelining**: SMTP komutları blok halinde gönderilmemeli, sunucu yanıtı beklenmelidir.
- [ ] **STARTTLS When Offered**: Sunucu `STARTTLS` destekliyorsa şifreli iletişime geçilmelidir.
- [ ] **Real MAIL FROM**: Var olan, bounce durumunda ulaşılabilecek gerçek bir `MAIL FROM` adresi kullanılmalıdır. Boş (null) sender `<>` veya sahte adresler tarpitting riskini artırır.
- [ ] **DATA Aşamasına Geçmeme**: `RCPT TO` başarılı olduktan hemen sonra `QUIT` gönderilmeli, asıl mail datasını göndermeye (`DATA`) geçilmemelidir.
- [ ] **Sadece 4xx Retry**: Sadece `tempfail` (4xx) hatalarında retry (yeniden deneme) yapılmalı.
- [ ] **5xx Retry Yok**: `rejected` (550) veya `policy block` (554) gibi 5xx hatalarında kesinlikle retry yapılmamalı, cooldown uygulanmalıdır. (Domain Behavior Cache bu işi üstlenir).

### 6. Provider Özel Notlar
Her provider'ın SMTP probing (namespace mining) algılama hassasiyeti farklıdır:
- **Gmail (Google)**: PTR kaydına, IP ve domain reputation'ına aşırı önem verir. Concurrency sıkı tutulmalıdır. Agresif taramalarda IP'yi geçici olarak "rate limit" (421) veya kalıcı block listesine alır.
- **Outlook (Microsoft)**: Reverse DNS (PTR) yokluğunda doğrudan reddeder. Namespace mining ve directory harvesting hassasiyeti çok yüksektir. "Catch-All" testleri gibi ardışık istekler hızla bloklanmaya sebep olabilir.
- **Yahoo**: IP ve DKIM reputation arar. Static görünümlü rDNS kayıtlarını tercih eder.
- **Yandex**: Permanent IP geçmişini izler. reverse DNS (PTR) kaydı ile birlikte informative (bilgilendirici) hostname kullanımını zorunlu tutar.
- **Enterprise Gateways (Proofpoint, Mimecast, Barracuda)**: Greylisting (ilk bağlantıyı 4xx ile geçici reddetme), tarpitting (yanıt sürelerini 10-20 saniyeye çıkarma) ve recipient filtering politikaları çok sıkıdır. `unknown` (tarpit) cevap dönme ihtimalleri yüksektir.

### 7. Monitoring Metrikleri
Validasyon kalitenizi korumak için Benchmark Experiment araçlarını kullanarak şu metrikleri sürekli izleyin:
- `timeoutRate`: Yükseliyorsa tarpit veya sessiz IP drop yiyorsunuz demektir.
- `tempfailRate`: Yükseliyorsa greylisting veya provider rate-limit (421) uygulanıyordur. Concurrency düşürün.
- `blockedRate`: Yükseliyorsa IP'niz doğrudan policy blok yemiştir (554).
- `unknownRate`: Tüm belirsiz sonuçların toplam oranıdır.
- `providerBreakdown`: Hangi provider'ın size daha çok engel çıkardığını izleyin.
- `blacklist status`: Harici (MxToolBox vb.) servisler üzerinden IP'nizin RBL/DNSBL listelerinde olup olmadığını düzenli kontrol edin.
- `Domain Behavior Cache`: Yüksek tempfail alan hedefleri izole eder.

### 8. Güvenli Test Stratejisi (Risk Warnings)
> ⚠️ **UYARI**: Üçüncü parti sunuculara agresif ve yüksek hacimli SMTP probing yapmak (özellikle rastgele sızdırılmış e-posta listelerinde) **zararlı aktivite (directory harvesting / namespace mining)** olarak algılanır.

- Sadece **sahip olduğunuz (owned)**, **izinli (consented)** veya kontrollü (controlled) test verisetleri (ör. `pilot.json`) kullanın.
- Yüksek hacimlere çıkmadan önce **düşük hacimlerle** (low volume) başlayın.
- Aynı kontrollü dataset'i farklı IP'lerle (cheap dc vs. clean dedicated) test ederek (IP tier comparison) ortamınızı kademeli büyütün.

### 9. .env Configuration Example
Production ortamı için optimal kurgu örneği:

```env
# Doğrulama ayarları
SMTP_VALIDATION_ENABLED=true
DNS_TIMEOUT_MS=5000

# Probe kimliği
SMTP_EHLO_NAME=mail.validator.example.com
SMTP_MAIL_FROM=probe@validator.example.com

# Concurrency & Cooldowns
SMTP_DOMAIN_CONCURRENCY=1
SMTP_PROVIDER_CONCURRENCY_DEFAULT=2
SMTP_PROVIDER_CONCURRENCY_GMAIL=1
SMTP_PROVIDER_CONCURRENCY_OUTLOOK=1
SMTP_PROVIDER_CONCURRENCY_YAHOO=1
SMTP_MAX_RETRIES=1
SMTP_RETRY_BACKOFF_MS=30000
SMTP_PROVIDER_COOLDOWN_MS=300000
SMTP_DOMAIN_COOLDOWN_MS=120000

# Catch-All
SMTP_CATCH_ALL_CHECK_ENABLED=true
SMTP_CATCH_ALL_RANDOM_PREFIX=verify
SMTP_CATCH_ALL_TIMEOUT_MS=8000
SMTP_CATCH_ALL_SKIP_PROVIDERS=gmail,outlook,yahoo

# Behavior Cache
DOMAIN_BEHAVIOR_CACHE_ENABLED=true
DOMAIN_BEHAVIOR_CACHE_TTL_MS=86400000
DOMAIN_BEHAVIOR_MIN_SAMPLE_SIZE=3
```

---

## Testler

```bash
npm test           # tüm testler
npm run test:cov   # coverage
```

DNS bağımlı testler `node:dns` mock'lanarak gerçek ağ olmadan çalışır.
