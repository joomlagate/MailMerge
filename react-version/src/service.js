/**
 * This is the interface between the iframe mailMerge UI and
 * the outside world (which has permission to send mail) */

// this will hold a reference to our parent so we can send messages
let _parentWindow = null,
    _resolveParentWindow;
// this promise will resolve when we've gotten word of who our parent is
const parentWindow = new Promise((resolve, reject) => {
    _resolveParentWindow = resolve;
});
let _messageId = 0;
function getUniqueMessageId() {
    return _messageId++;
}

// send a message to the parent window
// including payload. Returns a promise that
// is resolved by the parent's response.
async function messageParent(payload) {
    const { type, ...data } = payload;
    const message = {
        type: type,
        source: "CHILD",
        id: getUniqueMessageId(),
        data: data
    };

    const pWindow = await parentWindow;
    return new Promise((resolve, reject) => {
        // construct a listener that resolves the promise when
        // getting back a reply, then removes itself from
        // listening.
        let listener = e => {
            let data = e.data;
            // bail if this isn't a response for this message
            if (data.source !== "PARENT" || data.reply_id !== message.id) {
                return;
            }
            // if we're here, it's a response to this message
            window.removeEventListener("message", listener);
            resolve(data.data);
        };
        window.addEventListener("message", listener);
        pWindow.postMessage(message, "*");
    });
}

// Always listen for an INITIALIZE_PARENT message
// Unil we get this message, we can't send any messages!
window.addEventListener("message", e => {
    const data = e.data || {};
    if (data.type === "INITIALIZE_PARENT") {
        console.log(
            "Got signal from parent window to initialize",
            data,
            e.source
        );
        _parentWindow = e.source;
        _resolveParentWindow(_parentWindow);
    }
});

export { messageParent };
