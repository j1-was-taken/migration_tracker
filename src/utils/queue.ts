// utils/queue.ts
export const createQueue = <T>(
  processor: (item: T) => Promise<void>,
  delay = 1000
) => {
  const queue: T[] = [];
  let isProcessing = false;

  const processNext = async () => {
    if (isProcessing || !queue.length) return;
    isProcessing = true;

    const item = queue.shift();
    if (!item) {
      isProcessing = false;
      return;
    }

    try {
      await processor(item);
    } catch (err) {
      console.error("Queue processor error:", err);
    } finally {
      setTimeout(() => {
        isProcessing = false;
        processNext();
      }, delay);
    }
  };

  return {
    add: (item: T) => {
      queue.push(item);
      processNext();
    },
    get length() {
      return queue.length;
    },
  };
};
