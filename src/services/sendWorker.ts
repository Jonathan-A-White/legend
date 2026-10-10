// src/services/sendWorker.ts: the worker that sends the photo reader's grists (sendJob.ts says why), started by sendOffThread.ts.
import { runJob, type SendJob, type SendReply } from './sendJob';

const scope = self as unknown as { onmessage: ((event: MessageEvent<SendJob>) => void) | null; postMessage: (reply: SendReply) => void };

scope.onmessage = (event) => {
  void runJob(event.data).then((reply) => scope.postMessage(reply));
};
