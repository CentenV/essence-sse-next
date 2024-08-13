import { NextRequest, NextResponse } from "next/server";

const TERMINATION_PAYLOAD = { payload: null, status: "terminate" };

export class EssenceSSEServer<Type> {
    private readonly RESPONSE_STREAM = new TransformStream();
    private readonly RESPONSE_STREAM_WRITER = this.RESPONSE_STREAM.writable.getWriter();
    private readonly ENCODER = new TextEncoder();
    private eventTag: string;
    private open: boolean;

    /**
     * Initializes the SSE server object
     * 
     * @param request GET request NextRequest object for Essence to interact with internally
     * @param eventTag Subscription/event tag to identify the data stream between client and server
     */
    constructor(request: NextRequest, eventTag: string) {
        this.eventTag = eventTag;
        this.open = false;
        // Connection disconnected
        request.signal.onabort = () => {
            console.log("Connection aborted");
            this.closeSSE();
        }
    }
    
    /**
     * Opens the server sent events (SSE) connection. Needs to be invoked before any other SSE server functions can be called
     * 
     * @returns NextResponse object with the necessary headers already initialized
     */
    public openSSE(): NextResponse {
        this.open = true;
        return new NextResponse(this.RESPONSE_STREAM.readable, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "text/event-stream; charset=utf-8",
                Connection: "keep-alive",
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
                "Content-Encoding": "none",
            }
        });
    }

    /**
     * Closes the server sent events (SSE) connection. Needs to be invoked once 
     */
    public closeSSE() {
        this.open = false;
        // Notify subscriber of signal termination
        let payload = JSON.stringify(TERMINATION_PAYLOAD);
        this.RESPONSE_STREAM_WRITER.write(this.ENCODER.encode(`event: ${this.eventTag}`));
        this.RESPONSE_STREAM_WRITER.write(this.ENCODER.encode(payload));
        this.RESPONSE_STREAM_WRITER.close();
    }

    /**
     * Pushes data to the subscribed client
     * 
     * @param data A generic object ob key, value 
     */
    public pushData(data: Record<string, any> | Type) {
        // Assemble and convert payload for transit
        let payload = JSON.stringify({ payload: data, status: "running" });
        // Send the event tag and the data associtated with it
        this.RESPONSE_STREAM_WRITER.write(this.ENCODER.encode(`event: ${this.eventTag}`));
        this.RESPONSE_STREAM_WRITER.write(this.ENCODER.encode(payload));
    }
}

export class EssenceSSEClient<Type> {
    private eventTag: string;

    constructor(url: string, eventTag: string, dataUpdated: (sseData: Record<string, any> | Type) => unknown) {
        this.eventTag = eventTag;
        // SSE EventSource
        const source = new EventSource(url);
        source.addEventListener(eventTag, (event) => {
            // Handle data sent from server
            console.log(event.data);
            const payload = JSON.parse(event.data);
            console.log("Parsed payload: " + payload);
            if (payload === TERMINATION_PAYLOAD) {
                source.close();
                return;
            }
            // Call user defined update logic
            dataUpdated(payload);
        });
    }
}