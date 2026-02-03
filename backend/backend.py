from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from collections import deque
import json
import random
import string

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

class ClassroomNode:
    """Node in the classroom graph"""
    def __init__(self, room_id, building, capacity, floor, facilities):
        self.room_id = room_id
        self.building = building
        self.capacity = capacity
        self.floor = floor
        self.facilities = facilities
        self.adjacent_rooms = []
        self.bookings = []
    
    def add_adjacent(self, room_id):
        """Add adjacent room connection"""
        if room_id not in self.adjacent_rooms:
            self.adjacent_rooms.append(room_id)
    
    def is_available(self, date, start_time, end_time):
        """Check if room is available for given time slot"""
        for booking in self.bookings:
            if booking['date'] == date:
                # Check for time overlap
                if not (end_time <= booking['start_time'] or start_time >= booking['end_time']):
                    return False
        return True
    
    def add_booking(self, date, start_time, end_time, course_name, instructor):
        """Add a booking to the room"""
        booking_id = self.generate_booking_id()
        self.bookings.append({
            'date': date,
            'start_time': start_time,
            'end_time': end_time,
            'course_name': course_name,
            'instructor': instructor,
            'booking_id': booking_id,
            'timestamp': datetime.now().isoformat()
        })
        return booking_id
    
    @staticmethod
    def generate_booking_id():
        """Generate unique booking ID"""
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        return f"BK{timestamp}{random_str}"
    
    def to_dict(self):
        """Convert node to dictionary"""
        return {
            'room_id': self.room_id,
            'building': self.building,
            'capacity': self.capacity,
            'floor': self.floor,
            'facilities': self.facilities,
            'adjacent_rooms': self.adjacent_rooms,
            'bookings_count': len(self.bookings)
        }


class ClassroomGraph:
    """Graph data structure for classroom allocation system"""
    def __init__(self):
        self.rooms = {}  # Dictionary: room_id -> ClassroomNode
        self.allocation_queue = deque()  # Queue for pending requests
        self.logs = []
    
    def add_room(self, room_id, building, capacity, floor, facilities):
        """Add a room to the graph"""
        if room_id in self.rooms:
            return False, "Room already exists"
        
        room = ClassroomNode(room_id, building, capacity, floor, facilities)
        self.rooms[room_id] = room
        
        # Create edges based on adjacency rules
        self._create_edges(room_id)
        
        self.add_log('info', f"Added room {building} {room_id} to system")
        return True, "Room added successfully"
    
    def _create_edges(self, new_room_id):
        """Create edges between rooms based on adjacency rules"""
        new_room = self.rooms[new_room_id]
        
        for room_id, room in self.rooms.items():
            if room_id == new_room_id:
                continue
            
            # Connect rooms in same building
            if room.building == new_room.building:
                new_room.add_adjacent(room_id)
                room.add_adjacent(new_room_id)
            
            # Connect rooms with similar capacity (within 25%)
            capacity_diff = abs(room.capacity - new_room.capacity)
            max_capacity = max(room.capacity, new_room.capacity)
            if capacity_diff / max_capacity <= 0.25:
                new_room.add_adjacent(room_id)
                room.add_adjacent(new_room_id)
    
    def allocate_room(self, requirements):
        """
        Allocate a room using graph-based algorithm
        Returns: (success, result, booking_id)
        """
        course_name = requirements['course_name']
        instructor = requirements.get('instructor', '')
        date = requirements['date']
        start_time = requirements['start_time']
        end_time = requirements['end_time']
        capacity = requirements['capacity']
        building = requirements.get('building', '')
        facilities = requirements['facilities']
        
        self.add_log('info', f"Processing allocation for {course_name}")
        
        # Find suitable rooms using graph traversal
        suitable_rooms = []
        
        for room_id, room in self.rooms.items():
            # Check capacity
            if room.capacity < capacity:
                continue
            
            # Check building preference
            if building and room.building != building:
                continue
            
            # Check facilities
            facilities_match = all(
                room.facilities.get(facility, False)
                for facility, required in facilities.items()
                if required
            )
            
            if not facilities_match:
                continue
            
            # Check availability
            if room.is_available(date, start_time, end_time):
                suitable_rooms.append(room)
        
        if not suitable_rooms:
            self.add_log('error', f"No suitable rooms for {course_name}")
            return False, "No rooms match requirements or are available", None
        
        # Select best room (closest capacity match)
        best_room = min(suitable_rooms, key=lambda r: abs(r.capacity - capacity))
        
        # Book the room
        booking_id = best_room.add_booking(date, start_time, end_time, course_name, instructor)
        
        self.add_log('success', f"Allocated {best_room.building} {best_room.room_id} for {course_name} (ID: {booking_id})")
        
        return True, best_room.to_dict(), booking_id
    
    def get_room(self, room_id):
        """Get room details"""
        room = self.rooms.get(room_id)
        if room:
            return room.to_dict()
        return None
    
    def get_all_rooms(self):
        """Get all rooms"""
        return [room.to_dict() for room in self.rooms.values()]
    
    def get_schedule(self, room_id=None):
        """Get schedule for specific room or all rooms"""
        schedules = []
        
        if room_id:
            room = self.rooms.get(room_id)
            if room:
                for booking in room.bookings:
                    schedules.append({
                        'room': room.to_dict(),
                        'booking': booking
                    })
        else:
            for room in self.rooms.values():
                for booking in room.bookings:
                    schedules.append({
                        'room': room.to_dict(),
                        'booking': booking
                    })
        
        return schedules
    
    def detect_conflicts(self):
        """Detect scheduling conflicts"""
        conflicts = []
        
        for room in self.rooms.values():
            bookings = sorted(room.bookings, key=lambda x: (x['date'], x['start_time']))
            
            for i in range(len(bookings)):
                for j in range(i + 1, len(bookings)):
                    b1 = bookings[i]
                    b2 = bookings[j]
                    
                    if b1['date'] == b2['date']:
                        # Check for overlap
                        if not (b1['end_time'] <= b2['start_time'] or b2['end_time'] <= b1['start_time']):
                            conflicts.append({
                                'room_id': room.room_id,
                                'booking1': b1,
                                'booking2': b2
                            })
        
        return conflicts
    
    def add_log(self, log_type, message):
        """Add log entry"""
        log_entry = {
            'type': log_type,
            'message': message,
            'timestamp': datetime.now().isoformat()
        }
        self.logs.append(log_entry)
        
        # Keep only last 100 logs
        if len(self.logs) > 100:
            self.logs = self.logs[-100:]
    
    def get_logs(self):
        """Get all logs"""
        return list(reversed(self.logs))
    
    def get_statistics(self):
        """Get system statistics"""
        total_rooms = len(self.rooms)
        total_bookings = sum(len(room.bookings) for room in self.rooms.values())
        
        # Calculate utilization
        rooms_with_bookings = sum(1 for room in self.rooms.values() if len(room.bookings) > 0)
        utilization_rate = (rooms_with_bookings / total_rooms * 100) if total_rooms > 0 else 0
        
        return {
            'total_rooms': total_rooms,
            'total_bookings': total_bookings,
            'utilized_rooms': rooms_with_bookings,
            'utilization_rate': round(utilization_rate, 2),
            'conflicts': len(self.detect_conflicts())
        }
    
    def bfs_find_alternatives(self, start_room_id, date, start_time, end_time):
        """Find alternative rooms using BFS traversal"""
        if start_room_id not in self.rooms:
            return []
        
        visited = set()
        queue = deque([start_room_id])
        alternatives = []
        
        while queue:
            current_id = queue.popleft()
            
            if current_id in visited:
                continue
            
            visited.add(current_id)
            current_room = self.rooms[current_id]
            
            # Check if available
            if current_room.is_available(date, start_time, end_time):
                alternatives.append(current_room.to_dict())
            
            # Add adjacent rooms to queue
            for adjacent_id in current_room.adjacent_rooms:
                if adjacent_id not in visited:
                    queue.append(adjacent_id)
        
        return alternatives


# Initialize system
classroom_system = ClassroomGraph()


def initialize_sample_data():
    """Initialize with sample classroom data"""
    sample_rooms = [
        ('101', 'Main', 50, 1, {'projector': True, 'lab': False, 'accessible': True, 'whiteboard': True, 'audio': True, 'smartboard': False}),
        ('102', 'Main', 30, 1, {'projector': True, 'lab': False, 'accessible': True, 'whiteboard': True, 'audio': False, 'smartboard': True}),
        ('201', 'Science', 40, 2, {'projector': True, 'lab': True, 'accessible': False, 'whiteboard': True, 'audio': True, 'smartboard': False}),
        ('301', 'Engineering', 60, 3, {'projector': True, 'lab': True, 'accessible': True, 'whiteboard': True, 'audio': True, 'smartboard': True}),
        ('LAB-A', 'Science', 25, 1, {'projector': True, 'lab': True, 'accessible': True, 'whiteboard': False, 'audio': False, 'smartboard': True}),
        ('401', 'Engineering', 100, 4, {'projector': True, 'lab': False, 'accessible': True, 'whiteboard': True, 'audio': True, 'smartboard': True}),
        ('AUD-1', 'Arts', 200, 1, {'projector': True, 'lab': False, 'accessible': True, 'whiteboard': False, 'audio': True, 'smartboard': False}),
    ]
    
    for room_data in sample_rooms:
        classroom_system.add_room(*room_data)
    
    classroom_system.add_log('info', 'System initialized with sample data')


# Initialize on startup
initialize_sample_data()


# API Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'Classroom allocation system is running'})


@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    """Get all rooms"""
    rooms = classroom_system.get_all_rooms()
    return jsonify({'rooms': rooms})


@app.route('/api/rooms', methods=['POST'])
def add_room():
    """Add a new room"""
    data = request.json
    
    success, message = classroom_system.add_room(
        data['room_id'],
        data['building'],
        data['capacity'],
        data.get('floor', 0),
        data['facilities']
    )
    
    return jsonify({
        'success': success,
        'message': message
    }), 201 if success else 400


@app.route('/api/rooms/<room_id>', methods=['GET'])
def get_room(room_id):
    """Get specific room"""
    room = classroom_system.get_room(room_id)
    
    if room:
        return jsonify(room)
    else:
        return jsonify({'error': 'Room not found'}), 404


@app.route('/api/allocate', methods=['POST'])
def allocate_room():
    """Allocate a room"""
    requirements = request.json
    
    success, result, booking_id = classroom_system.allocate_room(requirements)
    
    if success:
        return jsonify({
            'success': True,
            'room': result,
            'booking_id': booking_id
        })
    else:
        return jsonify({
            'success': False,
            'message': result
        }), 400


@app.route('/api/schedule', methods=['GET'])
def get_schedule():
    """Get all schedules"""
    room_id = request.args.get('room_id')
    schedules = classroom_system.get_schedule(room_id)
    return jsonify({'schedules': schedules})


@app.route('/api/alternatives/<room_id>', methods=['POST'])
def find_alternatives(room_id):
    """Find alternative rooms using BFS"""
    data = request.json
    
    alternatives = classroom_system.bfs_find_alternatives(
        room_id,
        data['date'],
        data['start_time'],
        data['end_time']
    )
    
    return jsonify({'alternatives': alternatives})


@app.route('/api/conflicts', methods=['GET'])
def detect_conflicts():
    """Detect scheduling conflicts"""
    conflicts = classroom_system.detect_conflicts()
    return jsonify({'conflicts': conflicts})


@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get system logs"""
    logs = classroom_system.get_logs()
    return jsonify({'logs': logs})


@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    """Get system statistics"""
    stats = classroom_system.get_statistics()
    return jsonify(stats)


@app.route('/api/reset', methods=['POST'])
def reset_system():
    """Reset system with sample data"""
    global classroom_system
    classroom_system = ClassroomGraph()
    initialize_sample_data()
    
    return jsonify({
        'success': True,
        'message': 'System reset with sample data'
    })


if __name__ == '__main__':
    print("=" * 70)
    print("  SMART CLASSROOM ALLOCATION SYSTEM - Backend Server")
    print("=" * 70)
    print(f"  Total Rooms: {len(classroom_system.rooms)}")
    print(f"  Server: http://localhost:5000")
    print(f"  API: http://localhost:5000/api")
    print("=" * 70)
    print("\n  Press Ctrl+C to stop the server\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
