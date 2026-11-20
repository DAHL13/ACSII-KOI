export class ObjectPool {
  constructor(size, factory) {
    this.size = size;
    this.items = new Array(size);
    for (let i = 0; i < size; i++) {
      this.items[i] = factory(i);
    }
    this.cursor = 0;
  }

  acquire(overwriteOldest = true) {
    for (let i = 0; i < this.size; i++) {
      const idx = (this.cursor + i) % this.size;
      if (!this.items[idx].active) {
        this.cursor = (idx + 1) % this.size;
        return this.items[idx];
      }
    }
    if (!overwriteOldest) return null;
    const slot = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.size;
    return slot;
  }
}
