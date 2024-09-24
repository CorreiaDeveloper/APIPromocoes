class Queue {
    constructor() {
        this.items = [];
    }

    // Adiciona um item ao final da fila
    enqueue(item) {
        this.items.push(item);
    }

    // Remove e retorna o item no início da fila
    dequeue() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items.shift();
    }

    // Retorna o item no início da fila sem removê-lo
    peek() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items[0];
    }

    // Retorna verdadeiro se a fila estiver vazia
    isEmpty() {
        return this.items.length === 0;
    }

    // Retorna o tamanho da fila
    size() {
        return this.items.length;
    }

    // Limpa a fila (se necessário)
    clear() {
        this.items = [];
    }
}

module.exports = Queue;
