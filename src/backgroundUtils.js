




export function assertRequestSuccess(name, result) {
    const data = result.status === "fulfilled" ? result.value : null;
    if (result.status === "rejected") {
        msg = `[backgroun-script] ${name} failed", ${result.reason}`;
        console.error(msg);
        return msg;
    }
    return true
}

export function sendMessage(sendResponse, subType, payload, query) {
    sendResponse(
      {
        type: "DATA_AVAILABLE",
        subType : subType,
        payload : payload,
        query : query // not used
      }
    );
}