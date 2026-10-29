# WXY Botları (Security + Family Moderasyon + Family Botu)

Tek repo, tek Render servisi, 3 ayrı bot.

## 1) Discord'da 3 bot oluştur
https://discord.com/developers/applications → **New Application** (3 kez)
Her birinde:
- **Bot** sekmesi → **Reset Token** → token'ı kopyala
- **Privileged Gateway Intents**: *Server Members Intent* ve *Message Content Intent* AÇIK olsun
- Avatar/isim buradan değişir
- **OAuth2 → URL Generator**: scope `bot` + `applications.commands`, izin `Administrator` → çıkan linkle sunucuna ekle

Hangi uygulama hangi bot:
| Klasör | Env değişkeni |
|---|---|
| security | SECURITY_TOKEN |
| moderasyon | MODERASYON_TOKEN |
| family | FAMILY_TOKEN |

## 2) GitHub
Bu klasörü GitHub'a yükle. `.env` dosyasını ASLA yükleme (.gitignore zaten engelliyor).

## 3) Render
New → **Web Service** → repoyu seç
- Build Command: `npm install`
- Start Command: `npm start`
- Environment: `SECURITY_TOKEN`, `MODERASYON_TOKEN`, `FAMILY_TOKEN`, `OWNER_IDS` (senin Discord ID'n), `BRAND` (örn. WXY)

## Notlar
- Bot rolünü sunucuda en üste yakın tut (rol/ban/kick işlemleri için).
- Veriler `data/` klasöründe JSON olarak tutulur. Render ücretsiz planda her deploy/yeniden başlatmada silinir; kalıcı olsun istersen Render Disk veya MongoDB kullan.
- Render ücretsiz plan uyur; kod kendine ping atar ama istersen UptimeRobot ile de ping at.
- Yetki sistemi: `OWNER_IDS` = bot sahibi. Sahip üst yetkili ekler, üst yetkili normal yetkili ekler.
