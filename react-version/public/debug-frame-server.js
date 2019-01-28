/*
 * provide a messaging api equivalent to what is supplied by Thunderbird when
 * running as an extension
 */
"use strict";

let iframe = null;

// Log a message to #processing-log
function log(message) {
    let { type, direction, ...rest } = message;
    let li = document.createElement("li");
    let div1 = document.createElement("div");
    let div2 = document.createElement("div");
    div1.appendChild(document.createTextNode(type));
    div2.appendChild(document.createTextNode(JSON.stringify(rest, false, 4)));

    li.appendChild(div1);
    li.appendChild(div2);
    li.classList.add(direction);
    div1.classList.add("log-item");

    // set it up so clicking on an item in the log with shrink or exapnd its contents
    let hidden = false;
    function hideLogContents() {
        hidden = !hidden;
        if (hidden) {
            div2.classList.add("hidden");
            div1.classList.add("has-hidden-contents");
        } else {
            div2.classList.remove("hidden");
            div1.classList.remove("has-hidden-contents");
        }
    }
    div1.addEventListener("click", hideLogContents);
    hideLogContents();

    let logElm = document.getElementById("processing-log");
    if (logElm) {
        logElm.appendChild(li);
    }
}

// send a message to the child iframe so that it has a reference to us,
// it's parent.
function initializeChild() {
    let payload = { type: "INITIALIZE_PARENT" };
    iframe.contentWindow.postMessage(payload, "*");
    log({ ...payload, direction: "tochild" });
}

window.onload = e => {
    // Find our child iframe and send it a message as soon as possible
    // so it is capable of sending messages back.
    iframe = window.document.getElementById("content-frame");
    window.childFrame = iframe;

    if (iframe.contentDocument.readyState === "complete") {
        initializeChild();
    } else {
        iframe.onload = e => {
            initializeChild();
        };
    }

    //console.log("childFrame:", iframe);
};

// send a message to the child iframe
function messageChild(payload) {
    const { type, id, ...data } = payload;
    let message = {
        type: type,
        source: "PARENT",
        reply_id: id,
        data: data
    };
    iframe.contentWindow.postMessage(message, "*");
    log({ ...message, direction: "tochild" });
    //console.log("messaging child", message);
}

/*
 * Functions to simulate the mailmerge commands
 */
function getDefaultPreferences() {
    return {
        delay: 0,
        sendmode: "now",
        range: "",
        parser: "nunjucks",
        fileName: "",
        fileContents: []
    };
}
function getPreferences() {
    let prefs = getDefaultPreferences();
    try {
        prefs = JSON.parse(window.localStorage.getItem("prefs")) || prefs;
    } catch (e) {
        console.warn("error when decoding prefs from JSON");
    }
    return prefs;
}
function setPreferences(prefs) {
    let newPrefs = { ...getPreferences(), ...prefs };
    window.localStorage.setItem("prefs", JSON.stringify(newPrefs));
}
function getTemplate() {
    // return a dummy template
    const defaultTemplate = {
        from: "From Guy <from@guy.com>",
        to: "To Guy <to@guy.com>, {{email}}",
        cc: "To Guy CC <tocc@guy.com>",
        bcc: "To Guy BCC <tobcc@guy.com>",
        replyTo: "",
        attachment: "",
        subject: "Error processing template; this is a default template",
        body: "Hi {{name}}.\n\nPlease ask me about our special offer."
    };

    let textarea = document.querySelector("#template-textarea");
    try {
        let ret = JSON.parse(textarea.value);
        textarea.classList.remove("processing-error");
        return ret;
    } catch (e) {
        textarea.classList.add("processing-error");
        return defaultTemplate;
    }
}
function getLocalizedStrings() {
    return {
        next: "Next",
        previous: "Previous",
        cancel: "Cancel",
        send: "Send",
        data: "Data",
        dataInfo: "Open a spreadsheet file (.csv, .xlsx, .ods, etc.) or copy-and-paste data into the spreadsheet below.",
        openAFile: "Open a file...",
        settings: "Settings",
        preview: "Preview",
        sendMode: "Send mode:",
        sendModeDesc: "Set how messages will be delivered. Send Later will leave messages in the Drafts folder.",
        sendModeNow: "Send Now",
        sendModeLater: "Send Later",
        sendModeDraft: "Save as Draft",
        messageDelay: "Message delay:",
        messageDelayDesc: "Dealy, in seconds, between sending messages.",
        sendMessageRange: "Send Message Range:",
        sendMessageRangeDesc: "Send only specific messages as specified by this range.",
        parser: "Parser:",
        parserDesc: "Select the parser that will be used to substitute variables into the email template.",
        parserLegacy: "Legacy",
        previewEmpty: "No emails to preview. Try loading data in the {0} tab.",
        previewPreviewing: "Previewing {0} of {1}",
        about: "About",
        developers: "Developers",
        support: "Support",
        license: "License",
        donate: "Donate",
        euro: "{0} €",
        dollar: "$ {0}"
    };
}
function sendEmails(emails) {
    for (let email of emails) {
        console.log(
            "%c Sending Email",
            "background: blue; color: white;",
            email
        );
    }
}

window.addEventListener("message", e => {
    const payload = e.data || {};
    const { type, id, source, data } = payload;

    //console.log("parent window got", payload, e);
    if (source !== "CHILD") {
        // We got a message that wasn't from our child iframe.
        // It should be handled by a different event listener.
        return;
    }

    log({ ...payload, direction: "fromchild" });

    switch (type) {
        case "ECHO":
            messageChild(payload);
            break;
        case "GET_DEFAULT_PREFERENCES":
            messageChild({ type, id, prefs: getDefaultPreferences() });
            break;
        case "GET_PREFERENCES":
            messageChild({ type, id, prefs: getPreferences() });
            break;
        case "SET_PREFERENCES":
            setPreferences(data.prefs);
            messageChild({ type, id, prefs: getPreferences() });
            break;
        case "GET_TEMPLATE":
            messageChild({ type, id, template: getTemplate() });
            break;
        case "GET_LOCALIZED_STRINGS":
            messageChild({ type, id, strings: getLocalizedStrings() });
            break;
        case "SEND_EMAILS":
            sendEmails(data.emails);
            break;
        default:
            console.warn("Unknown message type", type);
    }
});
