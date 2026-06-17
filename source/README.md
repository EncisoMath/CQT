# Mini Quiz ABCD por QR

Este ZIP es un prototipo para probar un quiz que nace desde varios codigos QR.

## Archivos principales

- `index.html`: pantalla principal.
- `css/styles.css`: estilos.
- `js/app.js`: camara, lector QR, armado del quiz y mini quiz ABCD.
- `manifest.webmanifest`: instalacion como PWA.
- `sw.js`: cache basico para funcionar offline despues de cargar la app.
- `qr_texts/demo_qr_parts.txt`: textos de QR listos para copiar.

## Como probar en GitHub Pages

1. Descomprime este ZIP.
2. Sube todos los archivos a un repositorio de GitHub.
3. Ve a Settings -> Pages.
4. Publica desde la rama `main` y carpeta `/root`.
5. Abre la URL HTTPS de GitHub Pages.
6. Toca `Probar permiso` y despues `Escanear QR`.

## Como probar localmente

En la carpeta del proyecto:

```bash
python3 -m http.server 8080
```

Luego abre:

```text
http://localhost:8080/
```

## Formato del QR

Cada QR tiene este formato:

```text
EMQZ|v1|id=demo-offline-abcd|part=1/2|sum=a61098c1|data=...
```

Si el quiz requiere 2 QR, la app mostrara que faltan partes hasta completarlas.

## QR demo

### QR 1 de 2

```text
EMQZ|v1|id=demo-offline-abcd|part=1/2|sum=a61098c1|data=eyJpZCI6ImRlbW8tb2ZmbGluZS1hYmNkIiwidGl0bGUiOiJNaW5pIFF1aXogUVIgT2ZmbGluZSIsImRlc2NyaXB0aW9uIjoiUXVpeiBBQkNEIGxlw61kbyBkZXNkZSAyIGPDs2RpZ29zIFFSLiIsInRpbWVMaW1pdCI6MzAsInNjb3JlTW9kZSI6ImN1cnZlIiwiaXRlbXMiOlt7InR5cGUiOiJhYmNkIiwicXVlc3Rpb24iOiLCv0N1w6FudG8gZXMgNyB4IDg_Iiwib3B0aW9
```

### QR 2 de 2

```text
EMQZ|v1|id=demo-offline-abcd|part=2/2|sum=a61098c1|data=ucyI6WyI1NCIsIjU2IiwiNjQiLCI1OCJdLCJjb3JyZWN0IjoxLCJ0aW1lTGltaXQiOjMwLCJwb2ludHMiOjEwMDB9LHsidHlwZSI6ImFiY2QiLCJxdWVzdGlvbiI6IsK_Q3XDoWwgZnJhY2Npw7NuIGVxdWl2YWxlIGEgMS8yPyIsIm9wdGlvbnMiOlsiMi8zIiwiMy82IiwiNC81IiwiNS84Il0sImNvcnJlY3QiOjEsInRpbWVMaW1pdCI6MjUsInBvaW50cyI6MTAwMH1dfQ
```

## Nota sobre camara

Ninguna app web puede forzar permisos si Chrome los niega. Este prototipo intenta varias configuraciones de camara y tiene dos motores:

1. Lector nativo `BarcodeDetector`, funciona offline si el navegador lo soporta.
2. Lector alternativo online `html5-qrcode`, carga desde CDN cuando hay internet. En una implementacion final para EncisoMath se debe incluir esa libreria dentro del ZIP para que tambien funcione offline.
