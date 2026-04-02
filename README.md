# VeriFoto MVP

Prototipo web hecho con Next.js para demostrar una idea de producto:

- captura verificable con evidencia de origen
- certificado de autenticidad con hash y firma demo
- análisis de imágenes subidas con estados entendibles
- enfoque honesto: evidencia fuerte, no "certeza absoluta"

## Qué incluye este prototipo

Pantallas implementadas:

1. **Hero / propuesta de valor**
2. **Captura verificable**
   - nota de captura
   - ubicación opcional
   - generación demo de certificado
3. **Verificación y análisis**
   - carga de imagen
   - estados de resultado
   - señales técnicas simuladas
4. **Arquitectura MVP + fases**

## Demo del análisis

El flujo de análisis usa heurísticas simples basadas en el nombre del archivo para simular estados:

- `foto-proof.jpg` → verificada
- `retrato-ai.png` → posible IA
- `producto-editado.jpg` → posible edición
- cualquier otro nombre → sin prueba de origen

## Stack

- Next.js
- React
- Tailwind CSS
- Web Crypto API para hash demo SHA-256

## Ejecutar

```bash
npm install
npm run dev
```

Abrir en:

```bash
http://localhost:3000
```

## Próximos pasos recomendados

- persistir certificados en Supabase/Postgres
- registrar dispositivos/usuarios
- agregar endpoint real de verificación por hash
- generar exportación PDF del certificado
- integrar análisis real de metadatos y scoring heurístico
