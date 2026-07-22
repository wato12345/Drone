export class MinHeap {
  constructor() {
    this.data = []
  }

  get size() {
    return this.data.length
  }

  push(value, priority) {
    this.data.push({ value, priority })
    this.#bubbleUp(this.data.length - 1)
  }

  pop() {
    if (this.data.length === 0) return null
    const top = this.data[0].value
    const last = this.data.pop()
    if (this.data.length > 0) {
      this.data[0] = last
      this.#sinkDown(0)
    }
    return top
  }

  #bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (this.data[parent].priority <= this.data[index].priority) break
      ;[this.data[parent], this.data[index]] = [this.data[index], this.data[parent]]
      index = parent
    }
  }

  #sinkDown(index) {
    const length = this.data.length
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      let smallest = index

      if (left < length && this.data[left].priority < this.data[smallest].priority) {
        smallest = left
      }
      if (right < length && this.data[right].priority < this.data[smallest].priority) {
        smallest = right
      }
      if (smallest === index) break

      ;[this.data[smallest], this.data[index]] = [this.data[index], this.data[smallest]]
      index = smallest
    }
  }
}
