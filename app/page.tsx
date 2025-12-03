"use client"
import Image from "next/image"
import RoboIcon from './assets/robot-bot-icon.svg'
import {useChat} from '@ai-sdk/react'
import {UIMessage} from 'ai'


const Home = () => {
    const noMessages=true;
    const {append, isLoading, messages, input , handleInputChange , handleSubmit} = useChat()
  return (
    <main>
        <Image src={RoboIcon} alt="Icon for the project" width='135'/>
        <section>
            {noMessages?(
                <>
                    <p className="starter-text">
                        Your go-to hub for all Operating Systems knowledge! Ask OS-GPT anything—from process management and memory allocation to deadlocks and scheduling algorithms—and get clear, accurate, and up-to-date answers. Dive in and make learning Operating Systems easier than ever!
                    </p>
                    <br />
                    {/* <PromptSuggestionsRow/> */}
                </>
            ):(
                <>
                    {/* map messages onto text bubbles */}
                    {/* <LoadingBubble/> */}
                </>
            )}
        </section>
        <form action="" onSubmit={handleSubmit}>
                <input title="Input for question box" className="question-box" onChange={handleInputChange} value={input} placeholder="Ask me something..."/>
                <input type="submit" />
        </form>
    </main>
  )
}

export default Home