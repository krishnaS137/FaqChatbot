import PromptSuggestionButton from "./PromptSuggestionButton"

const PromptSuggestionsRow = ({onPromptClick}) => {
    const prompts =[
        "What is a process and process table?",
        "What are the different states of the process?",
        "What is a Thread?  ",
        "What are the differences between process and thread?"
    ]
  return (
    <div className="prompt-suggestion-row">
        {
            prompts.map((prompt,index)=> 
            <PromptSuggestionButton 
                key={`suggestion-${index}`}
                text={prompt}
                onClick={()=>onPromptClick(prompt)}
            />)
        }
    </div>
  )
}

export default PromptSuggestionsRow