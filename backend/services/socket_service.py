"""
socket_service.py — Holds a reference to the SocketIO instance so
route blueprints can emit events without circular imports.
"""

_socketio = None


def init_socketio(sio):
    global _socketio
    _socketio = sio


def get_socketio():
    return _socketio
