/* eslint-disable no-use-before-define */

'use strict';

const toIterator = base => {
  if (!base[Symbol.iterator]) {
    throw new TypeError('Base is not Iterable');
  }
  return base[Symbol.iterator]();
};

class Iterator {
  constructor(base) {
    this.base = toIterator(base);
  }

  [Symbol.iterator]() {
    return this;
  }

  next() {
    return this.base.next();
  }

  each(fn, thisArg) {
    this.forEach(fn, thisArg);
  }

  forEach(fn, thisArg) {
    for (const value of this) {
      fn.call(thisArg, value);
    }
  }

  every(predicate, thisArg) {
    for (const value of this) {
      if (!predicate.call(thisArg, value)) {
        return false;
      }
    }
    return true;
  }

  find(predicate, thisArg) {
    for (const value of this) {
      if (predicate.call(thisArg, value)) {
        return value;
      }
    }
  }

  includes(element) {
    for (const value of this) {
      if (value === element || (isNaN(value) && isNaN(element))) {
        return true;
      }
    }
    return false;
  }

  reduce(reducer, initialValue) {
    let result = initialValue;

    if (result === undefined) {
      const next = this.next();
      if (next.done) {
        throw new TypeError(
          'Reduce of consumed iterator with no initial value'
        );
      }
      result = next.value;
    }

    for (const value of this) {
      result = reducer(result, value);
    }
    return result;
  }

  some(predicate, thisArg) {
    for (const value of this) {
      if (predicate.call(thisArg, value)) {
        return true;
      }
    }
    return false;
  }

  someCount(predicate, count, thisArg) {
    let n = 0;
    for (const value of this) {
      if (predicate.call(thisArg, value)) {
        if (++n === count) return true;
      }
    }
    return false;
  }

  collectTo(CollectionClass) {
    return new CollectionClass(this);
  }

  collectWith(obj, collector) {
    this.forEach(element => collector(obj, element));
  }

  toArray() {
    return Array.from(this);
  }

  map(mapper, thisArg) {
    return new MapIterator(this, mapper, thisArg);
  }

  filter(predicate, thisArg) {
    return new FilterIterator(this, predicate, thisArg);
  }

  flat(depth = 1) {
    return new FlatIterator(this, depth);
  }

  flatMap(mapper, thisArg) {
    return new FlatMapIterator(this, mapper, thisArg);
  }

  zip(...iterators) {
    return new ZipIterator(this, iterators);
  }

  join(...iterators) {
    return new JoinIterator(this, iterators);
  }

  take(amount) {
    return new TakeIterator(this, amount);
  }

  takeWhile(predicate, thisArg) {
    return new TakeWhileIterator(this, predicate, thisArg);
  }

  skip(amount) {
    for (let i = 0; i < amount; i++) {
      this.next();
    }
    return this;
  }
}

class MapIterator extends Iterator {
  constructor(base, mapper, thisArg) {
    super(base);
    this.mapper = mapper;
    this.thisArg = thisArg;
  }

  next() {
    const { done, value } = this.base.next();
    return {
      done,
      value: done ? undefined : this.mapper.call(this.thisArg, value),
    };
  }
}

class FilterIterator extends Iterator {
  constructor(base, predicate, thisArg) {
    super(base);
    this.predicate = predicate;
    this.thisArg = thisArg;
  }

  next() {
    for (const value of this.base) {
      if (this.predicate.call(this.thisArg, value)) {
        return { done: false, value };
      }
    }
    return { done: true, value: undefined };
  }
}

class FlatIterator extends Iterator {
  constructor(base, depth) {
    super(base);
    this.currentDepth = 0;
    this.stack = new Array(depth + 1);
    this.stack[0] = base;
  }

  next() {
    while (this.currentDepth >= 0) {
      const top = this.stack[this.currentDepth];
      const next = top.next();

      if (next.done) {
        this.stack[this.currentDepth] = null;
        this.currentDepth--;
        continue;
      }

      if (
        this.currentDepth === this.stack.length - 1 ||
        !next.value[Symbol.iterator]
      ) {
        return next;
      }

      this.stack[++this.currentDepth] = next.value[Symbol.iterator]();
    }

    return { done: true, value: undefined };
  }
}

class FlatMapIterator extends Iterator {
  constructor(base, mapper, thisArg) {
    super(base);
    this.mapper = mapper;
    this.thisArg = thisArg;
    this.currentIterator = null;
  }

  next() {
    if (!this.currentIterator) {
      const next = this.base.next();
      if (next.done) {
        return next;
      }

      const value = this.mapper.call(this.thisArg, next.value);
      if (!value[Symbol.iterator]) {
        return { done: false, value };
      }

      this.currentIterator = toIterator(value);
    }

    const next = this.currentIterator.next();

    if (next.done) {
      this.currentIterator = null;
      return this.next();
    }
    return next;
  }
}

class TakeIterator extends Iterator {
  constructor(base, amount) {
    super(base);
    this.amount = amount;
    this.iterated = 0;
  }

  next() {
    this.iterated++;
    if (this.iterated <= this.amount) {
      return this.base.next();
    }
    return { done: true, value: undefined };
  }
}

class TakeWhileIterator extends Iterator {
  constructor(base, predicate, thisArg) {
    super(base);
    this.predicate = predicate;
    this.thisArg = thisArg;
    this.done = false;
  }

  next() {
    if (this.done) return { done: true, value: undefined };
    const next = this.base.next();
    if (!next.done && this.predicate.call(this.thisArg, next.value)) {
      return next;
    }
    this.done = true;
    return { done: true, value: undefined };
  }
}

class ZipIterator extends Iterator {
  constructor(base, iterators) {
    super(base);
    this.iterators = iterators.map(toIterator);
  }

  next() {
    const result = [];

    const next = this.base.next();
    if (next.done) {
      return next;
    }
    result.push(next.value);

    for (const iterator of this.iterators) {
      const next = iterator.next();
      if (next.done) {
        return next;
      }
      result.push(next.value);
    }
    return { done: false, value: result };
  }
}

class JoinIterator extends Iterator {
  constructor(base, iterators) {
    super(base);
    this.currentIterator = base;
    this.iterators = iterators.map(toIterator)[Symbol.iterator]();
  }

  next() {
    const next = this.currentIterator.next();
    if (!next.done) {
      return next;
    }
    const iterator = this.iterators.next();
    if (iterator.done) {
      return iterator;
    }
    this.currentIterator = iterator.value;
    return this.next();
  }
}

const iter = base => new Iterator(base);

module.exports = {
  Iterator,
  iter,
};