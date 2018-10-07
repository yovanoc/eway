// Port of lower_bound from http://en.cppreference.com/w/cpp/algorithm/lower_bound
// Used to compute insertion index to keep queue sorted after insertion
function lowerBound<T>(
  array: T[],
  value: T,
  comp: (a: T, b: T) => number
): number {
  let first = 0;
  let count = array.length;

  while (count > 0) {
    const step = (count / 2) | 0;
    let it = first + step;

    if (comp(array[it], value) <= 0) {
      first = ++it;
      count -= step + 1;
    } else {
      count = step;
    }
  }

  return first;
}

export interface IPriorityQueue {
  enqueue: (run: () => void, options?: IPriorityQueueOptions) => void;
  dequeue: () => () => void;
  size: number;
}

export interface IPriorityQueueElement {
  priority: number;
  run: () => void;
}

export interface IPriorityQueueOptions {
  priority: number;
}

export class PriorityQueue implements IPriorityQueue {
  private queue: IPriorityQueueElement[] = [];

  public enqueue(run: () => void, options?: IPriorityQueueOptions) {
    options = {
      priority: 0,
      ...options
    };

    const element: IPriorityQueueElement = { priority: options.priority, run };

    if (this.size && this.queue[this.size - 1].priority >= options.priority) {
      this.queue.push(element);
      return;
    }

    const index = lowerBound(
      this.queue,
      element,
      (a, b) => b.priority - a.priority
    );
    this.queue.splice(index, 0, element);
  }

  public dequeue() {
    const element = this.queue.shift();
    return element
      ? element.run
      : () => {
          /**/
        };
  }

  get size() {
    return this.queue.length;
  }
}
