// Graph Visualization using Canvas
class RoomGraphVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.edges = [];
        this.showLabels = true;
        this.showEdges = true;
        this.selectedNode = null;
        
        this.setupCanvas();
        this.setupInteraction();
    }
    
    setupCanvas() {
        // Set canvas size
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth - 40;
        this.canvas.height = 600;
    }
    
    setupInteraction() {
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
    }
    
    // Build graph from rooms data
    buildGraph(rooms) {
        this.nodes = [];
        this.edges = [];
        
        if (!rooms || rooms.length === 0) return;
        
        // Create nodes in circular layout
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 80;
        
        rooms.forEach((room, index) => {
            const angle = (index / rooms.length) * 2 * Math.PI - Math.PI / 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            this.nodes.push({
                id: room.room_id,
                building: room.building,
                capacity: room.capacity,
                facilities: room.facilities,
                x: x,
                y: y,
                color: this.getBuildingColor(room.building),
                adjacentRooms: []
            });
        });
        
        // Create edges based on adjacency
        for (let i = 0; i < rooms.length; i++) {
            for (let j = i + 1; j < rooms.length; j++) {
                const room1 = rooms[i];
                const room2 = rooms[j];
                
                // Same building
                if (room1.building === room2.building) {
                    this.edges.push({
                        from: i,
                        to: j,
                        type: 'building',
                        weight: 2
                    });
                    this.nodes[i].adjacentRooms.push(room2.room_id);
                    this.nodes[j].adjacentRooms.push(room1.room_id);
                }
                // Similar capacity
                else {
                    const capacityDiff = Math.abs(room1.capacity - room2.capacity);
                    const maxCapacity = Math.max(room1.capacity, room2.capacity);
                    if (capacityDiff / maxCapacity <= 0.25) {
                        this.edges.push({
                            from: i,
                            to: j,
                            type: 'capacity',
                            weight: 1
                        });
                        if (!this.nodes[i].adjacentRooms.includes(room2.room_id)) {
                            this.nodes[i].adjacentRooms.push(room2.room_id);
                        }
                        if (!this.nodes[j].adjacentRooms.includes(room1.room_id)) {
                            this.nodes[j].adjacentRooms.push(room1.room_id);
                        }
                    }
                }
            }
        }
        
        this.draw();
    }
    
    // Get color based on building
    getBuildingColor(building) {
        const colors = {
            'Main': '#4f46e5',
            'Science': '#10b981',
            'Engineering': '#f59e0b',
            'Arts': '#ec4899'
        };
        return colors[building] || '#6b7280';
    }
    
    // Draw the graph
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw edges
        if (this.showEdges) {
            this.edges.forEach(edge => {
                const from = this.nodes[edge.from];
                const to = this.nodes[edge.to];
                
                this.ctx.beginPath();
                this.ctx.moveTo(from.x, from.y);
                this.ctx.lineTo(to.x, to.y);
                
                if (edge.type === 'building') {
                    this.ctx.strokeStyle = 'rgba(79, 70, 229, 0.4)';
                    this.ctx.lineWidth = 2;
                    this.ctx.setLineDash([]);
                } else {
                    this.ctx.strokeStyle = 'rgba(107, 114, 128, 0.3)';
                    this.ctx.lineWidth = 1;
                    this.ctx.setLineDash([5, 5]);
                }
                
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            });
        }
        
        // Draw nodes
        this.nodes.forEach(node => {
            // Draw circle
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, 30, 0, 2 * Math.PI);
            this.ctx.fillStyle = node.color;
            this.ctx.fill();
            
            // Draw border
            if (this.selectedNode === node) {
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 4;
            } else {
                this.ctx.strokeStyle = '#1e293b';
                this.ctx.lineWidth = 3;
            }
            this.ctx.stroke();
            
            // Draw label
            if (this.showLabels) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 12px Poppins';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(node.id, node.x, node.y);
            }
        });
        
        // Draw tooltip for selected node
        if (this.selectedNode) {
            this.drawTooltip(this.selectedNode);
        }
    }
    
    // Draw tooltip
    drawTooltip(node) {
        const padding = 15;
        const lineHeight = 20;
        const tooltipWidth = 220;
        const tooltipHeight = 140;
        
        // Position tooltip
        let tooltipX = node.x + 40;
        let tooltipY = node.y - tooltipHeight / 2;
        
        // Keep tooltip in bounds
        if (tooltipX + tooltipWidth > this.canvas.width) {
            tooltipX = node.x - tooltipWidth - 40;
        }
        if (tooltipY < 0) {
            tooltipY = 10;
        }
        if (tooltipY + tooltipHeight > this.canvas.height) {
            tooltipY = this.canvas.height - tooltipHeight - 10;
        }
        
        // Draw background
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        this.ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // Draw border
        this.ctx.strokeStyle = node.color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
        
        // Draw text
        this.ctx.fillStyle = '#f1f5f9';
        this.ctx.font = 'bold 14px Poppins';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Room ${node.id}`, tooltipX + padding, tooltipY + padding + lineHeight);
        
        this.ctx.font = '12px Poppins';
        this.ctx.fillText(`Building: ${node.building}`, tooltipX + padding, tooltipY + padding + lineHeight * 2);
        this.ctx.fillText(`Capacity: ${node.capacity}`, tooltipX + padding, tooltipY + padding + lineHeight * 3);
        this.ctx.fillText(`Adjacent: ${node.adjacentRooms.length}`, tooltipX + padding, tooltipY + padding + lineHeight * 4);
        
        // Draw facilities
        const facilities = [];
        if (node.facilities.projector) facilities.push('Projector');
        if (node.facilities.lab) facilities.push('Lab');
        if (node.facilities.accessible) facilities.push('Accessible');
        
        if (facilities.length > 0) {
            this.ctx.fillText(`Facilities:`, tooltipX + padding, tooltipY + padding + lineHeight * 5);
            this.ctx.font = '11px Poppins';
            this.ctx.fillText(facilities.join(', '), tooltipX + padding, tooltipY + padding + lineHeight * 6);
        }
    }
    
    // Handle mouse move
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        let foundNode = null;
        
        for (let node of this.nodes) {
            const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
            if (distance <= 30) {
                foundNode = node;
                break;
            }
        }
        
        if (foundNode) {
            this.canvas.style.cursor = 'pointer';
            if (this.selectedNode !== foundNode) {
                this.selectedNode = foundNode;
                this.draw();
            }
        } else {
            this.canvas.style.cursor = 'default';
            if (this.selectedNode !== null) {
                this.selectedNode = null;
                this.draw();
            }
        }
    }
    
    // Handle click
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        for (let node of this.nodes) {
            const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
            if (distance <= 30) {
                console.log('Clicked node:', node);
                // Could add more interaction here
                break;
            }
        }
    }
    
    // Toggle labels
    toggleLabels(show) {
        this.showLabels = show;
        this.draw();
    }
    
    // Toggle edges
    toggleEdges(show) {
        this.showEdges = show;
        this.draw();
    }
}

// Global graph instance
let graphVisualizer = null;

// Initialize graph when rooms are loaded
setTimeout(() => {
    if (typeof allRooms !== 'undefined') {
        initializeGraph();
    }
}, 1000);

function initializeGraph() {
    graphVisualizer = new RoomGraphVisualizer('graph-canvas');
    regenerateGraph();
}

// Regenerate graph
function regenerateGraph() {
    if (!graphVisualizer) {
        initializeGraph();
    }
    if (graphVisualizer && typeof allRooms !== 'undefined') {
        graphVisualizer.buildGraph(allRooms);
    }
}

// Toggle labels
function toggleLabels() {
    const show = document.getElementById('show-labels').checked;
    if (graphVisualizer) {
        graphVisualizer.toggleLabels(show);
    }
}

// Toggle edges
function toggleEdges() {
    const show = document.getElementById('show-edges').checked;
    if (graphVisualizer) {
        graphVisualizer.toggleEdges(show);
    }
}

// Redraw graph when window resizes
window.addEventListener('resize', () => {
    if (graphVisualizer) {
        graphVisualizer.setupCanvas();
        graphVisualizer.draw();
    }
});
