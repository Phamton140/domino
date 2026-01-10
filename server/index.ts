import express, { Express, Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSocketHandlers } from './socket';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

setupSocketHandlers(io);

app.get('/', (req: Request, res: Response) => {
    res.send('Domino Server is running');
});

server.listen(port as number, '0.0.0.0', () => {
    console.log(`[server]: 🟢 LIVE on http://0.0.0.0:${port} (All Interfaces)`);
    console.log(`[network]: Connect your phone to http://192.168.1.13:${port}`);
});
