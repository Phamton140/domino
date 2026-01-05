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

server.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
