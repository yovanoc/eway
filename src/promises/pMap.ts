export interface IOptions {
	/**
	 * Number of concurrently pending promises returned by `mapper`.
	 *
	 * @default Infinity
	 */
    concurrency?: number;
}

/**
 * Function which is called for every item in `input`. Expected to return a `Promise` or value.
 *
 * @param input - Iterated element.
 * @param index - Index of the element in the source array.
 */
export type Mapper<Element = any, NewElement = any> = (input: Element, index: number) => NewElement | Promise<NewElement>

/**
 * Returns a `Promise` that is fulfilled when all promises in `input` and ones returned from `mapper` are fulfilled, or rejects if any of the promises reject. The fulfilled value is an `Array` of the fulfilled values returned from `mapper` in `input` order.
 *
 * @param input - Iterated over concurrently in the `mapper` function.
 * @param mapper - Function which is called for every item in `input`. Expected to return a `Promise` or value.
 * @param options - Options-object.
 *
 * @example
 *
 * const sites = [
 * 	'ava.li',
 * 	'todomvc.com
 * ];
 *
 * (async () => {
 * 	const mapper = async site => {
 * 		const {requestUrl} = await got.head(site);
 * 		return requestUrl;
 * 	};
 *
 * 	const result = await pMap(sites, mapper, {concurrency: 2});
 * 	//=> ['http://ava.li/', 'http://todomvc.com/']
 * })();
 */

export function pMap<Element, NewElement>(iterable: Iterable<Element>, mapper: Mapper<Element, NewElement>, options?: IOptions): Promise<NewElement[]> {
    return new Promise((resolve, reject) => {
        options = {
            concurrency: Infinity, ...options
        };

        if (typeof mapper !== 'function') {
            throw new TypeError('Mapper function is required');
        }

        const { concurrency } = options;

        if (!(typeof concurrency === 'number' && concurrency >= 1)) {
            throw new TypeError(`Expected \`concurrency\` to be a number from 1 and up, got \`${concurrency}\` (${typeof concurrency})`);
        }

        const ret: NewElement[] = [];
        const iterator = iterable[Symbol.iterator]();
        let isRejected = false;
        let isIterableDone = false;
        let resolvingCount = 0;
        let currentIndex = 0;

        const next = () => {
            if (isRejected) {
                return;
            }

            const nextItem = iterator.next();
            const i = currentIndex;
            currentIndex++;

            if (nextItem.done) {
                isIterableDone = true;

                if (resolvingCount === 0) {
                    resolve(ret);
                }

                return;
            }

            resolvingCount++;

            Promise.resolve(nextItem.value)
                .then(element => mapper(element, i))
                .then(
                    value => {
                        ret[i] = value;
                        resolvingCount--;
                        next();
                    },
                    error => {
                        isRejected = true;
                        reject(error);
                    }
                );
        };

        for (let i = 0; i < concurrency; i++) {
            next();

            if (isIterableDone) {
                break;
            }
        }
    });
}
