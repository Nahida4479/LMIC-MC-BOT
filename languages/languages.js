const messages = {
    en: {
        busy: "I am busy right now",
        dontSeeYou: "I don't see you",
        foundOnly: "I could only find",
        collected: "I collected",
        noProblem: "No problem, I find for you",
        IdontHave: "I don't have any",
        HereYouGo: "Here you go:",
        giveError: "Something went wrong giving you"
    },

    pl: {
        busy: "Sory stary niemam teraz czasu. Poczekaj chwilę",
        dontSeeYou: "Gdzie ty jesteś?",
        foundOnly: "Mam tylko",
        collected: "Mam dla ciebie",
        noProblem: "Niema problemu znajdę dla ciebie",
        IdontHave: "Nie mam",
        HereYouGo: "Proszę to dla ciebie:",
        giveError: "Nie mogę dać ci itemów"
        }
}

function getMessage(language, key) {
    if (language === "pl") {
        return messages.pl[key]
    }
    return messages.en[key]
}

module.exports = { messages: messages, getMessage: getMessage}