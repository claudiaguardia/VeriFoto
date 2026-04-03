# VeriFoto MVP

VeriFoto pasó de demo visual a un MVP más realista en navegador.

## Qué hace ahora

- abre la cámara del navegador cuando está disponible
- permite tomar una foto real desde la app
- permite elegir una imagen desde el dispositivo
- calcula **hash SHA-256 real** del archivo
- genera un certificado local con:
  - id
  - fecha/hora
  - dispositivo
  - firma derivada
  - ubicación opcional
  - nota
- guarda certificados en **localStorage**
- verifica imágenes por **coincidencia real de hash** contra capturas registradas en ese mismo dispositivo

## Qué NO hace todavía

- no tiene backend
- no comparte certificados entre dispositivos
- no hace análisis forense profundo real
- no puede asegurar si una foto externa es real o IA si nunca fue registrada antes

Eso es intencional: en ese caso responde **“sin prueba de origen”**, que es mucho más honesto.

## Flujo correcto de uso

1. abrir la app
2. registrar una captura desde cámara o elegir una imagen
3. guardar el certificado
4. luego subir esa misma imagen en la sección de verificación
5. la app compara el hash y, si coincide, la marca como **verificada**

## Stack

- Next.js
- React
- Tailwind CSS
- Web Crypto API
- localStorage para persistencia local del MVP
- getUserMedia para acceso a cámara en navegador

## Ejecutar

```bash
npm install
npm run dev
```

Abrir en:

```bash
http://localhost:3000
```

## Próximo paso recomendado

La siguiente versión seria es conectar:

- Supabase/Postgres para persistencia real
- storage para imágenes y certificados
- auth por usuario/dispositivo
- verificación por hash desde cualquier equipo
- análisis técnico más fuerte de metadatos y señales de edición
