<script setup lang="ts">
import { ref } from 'vue'

interface Item {
  id: number
  name: string
}

const items = ref<Item[]>([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' }
])

const draggedIndex = ref<number | null>(null)

const onDragStart = (index: number, event: DragEvent): void => {
  draggedIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', JSON.stringify(items.value[index]))
  }
}

const onDragOver = (index: number, event: DragEvent): void => {
  // Prevent default to allow drop
  event.preventDefault()
}

const onDrop = (index: number, event: DragEvent): void => {
  event.preventDefault()
  console.log('Drop Event:', event.dataTransfer?.getData('text/plain'))
  console.log('Dropped on index:', index)

  if (draggedIndex.value === null) return

  const draggedItem = items.value[draggedIndex.value]
  items.value.splice(draggedIndex.value, 1) // Remove from the original position
  items.value.splice(index, 0, draggedItem) // Insert at the new position
  draggedIndex.value = null // Reset the state
}
</script>

<template>
  <div>
    <ul>
      <li
        v-for="(item, index) in items"
        :key="item.id"
        draggable="true"
        @dragstart="onDragStart(index, $event)"
        @dragover.prevent="onDragOver(index, $event)"
        @drop="onDrop(index, $event)"
      >
        {{ item.name }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
ul {
  list-style: none;
  padding: 0;
}
li {
  padding: 10px;
  margin: 5px 0;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  cursor: grab;
}
li:active {
  cursor: grabbing;
}
</style>
