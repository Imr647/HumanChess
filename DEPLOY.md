# HumanChess — Deploy

## Mini PC (live omgeving)

| Onderdeel | Waarde |
|-----------|--------|
| Host | `chess.local` / `192.168.1.126` |
| SSH user | `i647` |
| Pad | `/home/i647/humanchess` |
| Service | `humanchess.service` (systemd --user) |
| Poort | `8100` (direct) en `80` via Caddy (WatchWatcher gebruikt 8000) |
| URL | **http://chess.local** (of http://192.168.1.126) |

De backend (FastAPI) serveert zowel de API als de gebouwde frontend
(`frontend/dist`), dus er is één service op één poort. Een **Caddy**
reverse proxy (`caddy.service`, systemd --user) luistert op poort 80 en
stuurt door naar `127.0.0.1:8100`, zodat je geen poortnummer hoeft te typen.

## Eenmalige systeem-stappen (met sudo)

Deze zijn op de mini al gedaan of moeten eenmalig gebeuren:

```bash
# Poort 80 toestaan voor user-processen (persistent)
sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80
echo 'net.ipv4.ip_unprivileged_port_start=80' | sudo tee /etc/sysctl.d/99-unprivileged-ports.conf

# Firewall openzetten
sudo ufw allow 80/tcp
```

De mini heet `chess`, zodat avahi/systemd-resolved `chess.local` publiceren:

```bash
sudo hostnamectl set-hostname chess
sudo sed -i 's/\bCashyUM\b/chess/g' /etc/hosts
sudo sed -i '/chess\.local/d' /etc/avahi/hosts
sudo systemctl restart systemd-resolved avahi-daemon
```

Zonder de sysctl/ufw-stap kan `caddy.service` niet op poort 80 binden en
herstart de service blijven proberen. Let op: op poort 5353 draait ook Steam
(`steamwebhelper`); mDNS-publicatie van *extra* namen naast de hostnaam werkt
daardoor niet betrouwbaar — vandaar de hostnaam-aanpak.

## Deployen

```bash
# Vanuit /home/i647/Projects/HumanChess:
./deploy.sh
# Alleen pullen/bouwen/herstarten, zonder git push:
./deploy.sh --skip-git
```

`deploy.sh` doet: git commit + push → repo pullen op de mini →
( eerste keer: volledige setup ) → frontend bouwen → service herstarten.

## Handmatig

```bash
ssh i647@192.168.1.126
cd /home/i647/humanchess
git fetch origin && git reset --hard origin/master
bash scripts/remote_deploy.sh
```

## Beheer

```bash
ssh i647@192.168.1.126 systemctl --user status humanchess
ssh i647@192.168.1.126 journalctl --user -u humanchess -f
ssh i647@192.168.1.126 systemctl --user restart humanchess
```

## Bijzonderheden

- **Geen sudo nodig**: alles staat in de home-map van `i647`.
- **Eerste deploy is traag**: dan worden Python 3.12, CPU-PyTorch, Stockfish en
  de Maia-3 modellen gedownload en de frontend gebouwd.
- **Runtime data** (`data/humanchess.db`, spelerrating) staat alleen op de mini
  en wordt nooit door een deploy overschreven (gitignored).
- **Geheugen**: de mini heeft ~11 GB RAM; Maia-3 draait op CPU (5M-model) en
  Stockfish is begrensd via `HCHESS_SF_HASH=128` / `HCHESS_SF_THREADS=4`
  in `humanchess.service`.
- **Ander pad nodig** (`/opt`)? Dat vereist eenmalig sudo; pas dan de paden in
  `deploy.sh`, `humanchess.service` en `scripts/remote_deploy.sh` aan.
