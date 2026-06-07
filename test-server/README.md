# Code Scanner Test-Server

Kleiner Node.js/Express-Server zum Testen der Android-App. Er nimmt POST-Requests auf jedem Pfad entgegen, loggt Header und Body auf der Konsole und antwortet mit `OK`.

## Starten

```bash
cd test-server
npm install
npm start
```

Standard-Port: `3020`

Anderen Port verwenden:

```bash
PORT=4000 npm start
```

## URL in der App

Auf dem Handy muss die IP-Adresse deines Rechners im gleichen Netzwerk eingetragen werden, z.B.:

```text
http://192.168.0.100:3020
```

## Test per curl

```bash
curl -X POST http://localhost:3020 \
  -H 'Content-Type: application/json' \
  -d '{"content":"9781234567890","type":"EAN_13"}'
```
