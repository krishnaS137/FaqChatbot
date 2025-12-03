import { DataAPIClient } from "@datastax/astra-db-ts"
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer"


import {RecursiveCharacterTextSplitter} from "@langchain/textsplitters"

import "dotenv/config"

import { CohereClient } from "cohere-ai";
const cohere = new CohereClient({
    token: process.env.COHERE_API_KEY,
});

type SimilarityMatrics = "dot_product" | "cosine" |  "euclidean"

const {
    ASTRA_DB_NAMESPACE, 
    ASTRA_DB_COLLECTION, 
    ASTRA_DB_API_ENDPOINT, 
    ASTRA_DB_APPLICATION_TOKEN, 
    OPENAI_API_KEY
} = process.env




const faqData=[
    "https://www.geeksforgeeks.org/operating-systems/operating-systems-interview-questions/",
    "https://www.interviewbit.com/operating-system-interview-questions/",
    "https://www.scribd.com/document/39030682/6674160-Operating-Systems-Faqs",
    "https://herovired.com/home/learning-hub/blogs/os-interview-questions"
]

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT,{namespace:ASTRA_DB_NAMESPACE})

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize:512,
    chunkOverlap:100
})

const createCollection= async (similarityMetric:SimilarityMatrics="dot_product") => {
    const res = await db.createCollection(ASTRA_DB_COLLECTION, {
        vector:{
            dimension:1024,
            metric:similarityMetric
        }
    })
    console.log(res)
}


const loadSampleData=async () => {
    const collection = await db.collection(ASTRA_DB_COLLECTION)
    for await (const url of faqData){
        const content = await scrapePage(url)
        const chunks = await splitter.splitText(content);
        for await (const chunk of chunks){
            const embedding = await cohere.embed({
                texts: [chunk],
                model: "embed-english-v3.0",
                inputType: "search_document"
            });

            const vector = embedding.embeddings[0];


            const res=await collection.insertOne({
                $vector: vector,
                text: chunk
            })
            console.log(res)
        }
    }
}

const scrapePage = async (url:string) => {
    const loader= new PuppeteerWebBaseLoader(url,{
        launchOptions:{
            headless:true
        },
        gotoOptions:{
            waitUntil:"domcontentloaded"
        },
        evaluate:async (page,browser)=>{
           const result = await page.evaluate(()=>document.body.innerHTML)
           await browser.close();
           return result;
        }
    })
    return (await loader.scrape())?.replace(/<[^>]*>?/gm, '')
}


createCollection().then(()=>loadSampleData())