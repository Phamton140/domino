# 🎲 Domino Dominicano Profesional

Aplicación multiplayer en tiempo real para jugar Dominó Dominicano con reglas auténticas.

## 🚀 Características

- ✅ **Reglas Dominicanas Auténticas**
  - Doble Seis obliga en primera mano
  - Sistema de puntuación por equipos (2v2)
  - Capicúa con bonus de +30 puntos
  - Tranque (juego bloqueado)
  - Victoria a 200 puntos

- 🎮 **Funcionalidades del Juego**
  - Temporizador de 8 segundos por turno
  - Extensión de pensamiento (15 segundos adicionales)
  - Sistema de múltiples manos
  - Detección anti-cheat (cambio de pestaña)

- 🌐 **Multiplayer**
  - Salas privadas con código
  - Matchmaking público automático
  - Comunicación en tiempo real con WebSockets

## 📋 Requisitos Previos

- **Node.js** v18+ 
- **npm** v9+

## 🛠️ Instalación

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd domino
```

### 2. Instalar dependencias del servidor
```bash
cd server
npm install
```

### 3. Instalar dependencias del cliente
```bash
cd ../client
npm install
```

### 4. Configurar variables de entorno

**Servidor** (`server/.env`):
```env
PORT=3000
NODE_ENV=development
```

**Cliente** (`client/.env`):
```env
VITE_SERVER_URL=http://localhost:3000
```

## 🎯 Ejecución

### Modo Desarrollo

**Terminal 1 - Servidor:**
```bash
cd server
npm run dev
```

**Terminal 2 - Cliente:**
```bash
cd client
npm run dev
```

El servidor estará en `http://localhost:3000`  
El cliente estará en `http://localhost:5173`

### Modo Producción

**Compilar servidor:**
```bash
cd server
npm run build
npm start
```

**Compilar cliente:**
```bash
cd client
npm run build
npm run preview
```

## 🎮 Cómo Jugar

1. **Crear/Unirse a una Sala**
   - Ingresa tu nombre
   - Elige "Play Online" para matchmaking automático
   - O crea una sala privada y comparte el código

2. **Esperar Jugadores**
   - Se necesitan 4 jugadores para comenzar
   - El anfitrión inicia el juego

3. **Jugar**
   - Haz clic en tus fichas para jugarlas
   - Si una ficha encaja en ambos lados, elige dónde colocarla
   - Usa el botón "Extensión" si necesitas más tiempo
   - Pasa tu turno si no tienes jugadas válidas

4. **Ganar**
   - El primer equipo en alcanzar 200 puntos gana la partida

## 🏗️ Estructura del Proyecto

```
domino/
├── client/                 # Frontend React + TypeScript
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   ├── socket.ts      # Configuración Socket.IO
│   │   └── types.ts       # Tipos TypeScript
│   └── package.json
│
├── server/                # Backend Node.js + TypeScript
│   ├── gameEngine.ts      # Lógica del juego
│   ├── roomManager.ts     # Gestión de salas
│   ├── socket.ts          # Handlers WebSocket
│   ├── types.ts           # Tipos compartidos
│   └── package.json
```

## 🧪 Testing

```bash
cd server
npm test
```

## 🛡️ Reglas del Dominó Dominicano

### Inicio del Juego
- **Primera mano**: El jugador con doble-6 debe jugarlo
- **Siguientes manos**: El ganador de la mano anterior inicia

### Puntuación
- El equipo ganador suma los puntos de TODAS las fichas restantes
- **Capicúa**: Cuando la última ficha encaja en ambos extremos (+30 puntos bonus)
- **Tranque**: Juego bloqueado, gana quien tenga menos puntos en mano

### Victoria
- Primer equipo en alcanzar **200 puntos** gana la partida

## 🔧 Tecnologías

- **Frontend**: React 19, TypeScript, Vite, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, TypeScript
- **Testing**: Jest

## 📝 Scripts Disponibles

### Servidor
- `npm run dev` - Ejecutar en modo desarrollo
- `npm run build` - Compilar TypeScript
- `npm start` - Ejecutar versión compilada
- `npm test` - Ejecutar tests

### Cliente
- `npm run dev` - Servidor de desarrollo Vite
- `npm run build` - Build de producción
- `npm run preview` - Preview del build
- `npm run lint` - Linter ESLint

## 🐛 Solución de Problemas

### El servidor no inicia
- Verifica que el puerto 3000 esté disponible
- Revisa que las dependencias estén instaladas: `npm install`

### El cliente no se conecta
- Verifica que el servidor esté corriendo
- Revisa la variable `VITE_SERVER_URL` en `client/.env`

### Errores de TypeScript
- Ejecuta `npm run build` para ver errores de compilación
- Verifica que las versiones de TypeScript coincidan

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👥 Autores

Desarrollado con ❤️ para los amantes del Dominó Dominicano

---

**¡Disfruta el juego! 🎲🎉**
