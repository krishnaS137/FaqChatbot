// @ts-ignore: Allow side-effect import of global CSS without type declarations
import "./global.css"
import { Children } from "react"

export const metadata ={
    title:"FaqGPT",
    description: "The one shot place for all the Operating System questions"
}

const RootLayout =({children})=>{
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    )
}

export default RootLayout