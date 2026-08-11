const messages = {
    en: {
        busy: "I am busy right now",
        dontSeeYou: "I don't see you",
        foundOnly: "I could only find",
        collected: "I collected"
    },

    pl: {
        busy: "Sory stary niemam teraz czasu. Poczekaj chwilę",
        dontSeeYou: "Gdzie ty jesteś?",
        foundOnly: "Mam tylko",
        collected: "Mam dla ciebie"
    }
}

function getMessage(language, key) {
    if (language === "pl") {
        return messages.pl[key]
    }
    return messages.en[key]
}

module.exports = { messages: messages, getMessage: getMessage}