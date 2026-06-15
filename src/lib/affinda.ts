import { AffindaAPI, AffindaCredential } from "@affinda/affinda";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.AFFINDA_API_KEY;

if (!apiKey) {
    console.warn("Warning: AFFINDA_API_KEY is not set.");
}

const credential = new AffindaCredential(apiKey || "");
export const affindaClient = new AffindaAPI(credential);
