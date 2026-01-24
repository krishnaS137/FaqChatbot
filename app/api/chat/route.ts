import OpenAi, { OpenAI } from 'openai'
import {OpenAIStream, StreamingTextResponse} from 'ai'
import { DataAPIClient } from '@datastax/astra-db-ts'

import { CohereClient } from "cohere-ai";
const cohere = new CohereClient({
    token: process.env.COHERE_API_KEY,
});

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
    COHERE_API_KEY
}=process.env

const client=new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)

const db=client.db(ASTRA_DB_API_ENDPOINT,{namespace:ASTRA_DB_NAMESPACE})

export async function POST(req:Request){
    try{
        const {messages}=await req.json()
        const latestMessage = messages[messages?.length-1]?.content

        let docContext=""

        const embedding = await cohere.embed({
                texts: [latestMessage],
                model: "embed-english-v3.0",
                inputType: "search_document"
        });
        
        try{
            const collection= await db.collection(ASTRA_DB_COLLECTION)
            const cursor=collection.find(null,{
                sort:{
                    $vector: embedding.embeddings[0],
                },
                limit:10
            })
            const documents =await cursor.toArray()
            const docsMap=documents?.map(doc=>doc.text)
            docContext=JSON.stringify(docsMap)
        }
        catch(err){
            console.log(err)
            docContext=""
        }

        const template=`SYSTEM: You are an AI assistant who knows everything about Operating
            Systems. 
            Context:Use the below context to augment what you know about the Operating Systems.
            The context will provide you with the most recent page data from geeksforgeeks,interviewbit website and others.
            If the context doesn't include the information you need answer based on your existing knowledge and don't mention the source of your information or what the context does or doesn't include.
            Format responses using markdown where applicable and don't return images.
            -------------
            START CONTEXT
            ${docContext}
            END CONTEXT
            -------------
            QUESTION:${latestMessage}
            `
        // --- 4) Generate with Cohere Chat API ---
        const cohereStream = await cohere.chatStream({
        model: "command-r7b-12-2024",  // pick the live model your key allows
        message: template,         // your SDK expects a string message
        accepts: "text/event-stream",  // request SSE/NDJSON style events
        // optional: stream: true
        temperature: 0.2,
        maxTokens: 400,
        });

        // 5) convert Cohere async-iterator -> ReadableStream and forward textual deltas
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                for await (const rawPart of (cohereStream as AsyncIterable<any>)) {
                    // Cast to any for runtime inspection
                    const part: any = rawPart;
                    
                    // Debug log first few parts (optional) to confirm structure
                    console.debug("cohere stream part:", JSON.stringify(part).slice(0, 500));

                    // Try several common shapes (delta, message, text)
                    let deltaText: string | undefined;

                    if (part === null || part === undefined) {
                    deltaText = undefined;
                    } else if (typeof part === "string") {
                    // some SDK versions yield raw strings
                    deltaText = part;
                    } else if (typeof part === "object") {
                    // common streaming shapes:
                    // { delta: { content: "..." } }
                    if (part.delta && typeof part.delta.content === "string") {
                        deltaText = part.delta.content;
                    }
                    // { message: { content: "..." } }
                    else if (part.message && typeof part.message.content === "string") {
                        deltaText = part.message.content;
                    }
                    // { text: "..." }
                    else if (typeof part.text === "string") {
                        deltaText = part.text;
                    }
                    // some payloads use nested fields like part.data or part.output
                    else if (part.data && typeof part.data === "string") {
                        deltaText = part.data;
                    } else {
                        // nothing matched — optionally log the unknown part for debugging
                        // console.debug("Unknown stream part shape:", part);
                        deltaText = undefined;
                    }
                    }

                    if (deltaText && deltaText.length > 0) {
                    controller.enqueue(encoder.encode(deltaText));
                    }
                }

                controller.close();
                } catch (err) {
                controller.error(err);
                }
            },

            cancel() {
                try {
                if (typeof (cohereStream as any).return === "function") (cohereStream as any).return();
                } catch {}
            },
            });

        // 6) return with the same wrapper used for OpenAI streaming so frontend code stays unchanged
        return new StreamingTextResponse(stream);
    }
    catch(err){
        throw err;
    }
}