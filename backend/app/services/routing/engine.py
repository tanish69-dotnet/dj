from typing import Dict, Optional

import networkx as nx
from sqlalchemy.orm import Session

from ... import models


def build_graph(db: Session, city: Optional[str] = None) -> nx.DiGraph:
    """Build the routable graph. When city is given only that sector's
    corridors are loaded, so a dispatch can never be routed through another
    city's network."""
    G = nx.DiGraph()
    q = db.query(models.Road)
    if city:
        q = q.filter(models.Road.city == city)
    for road in q.all():
        if road.status == "OPEN":
            G.add_edge(road.source_id, road.target_id, weight=road.travel_time, id=road.id)
            # Assuming roads are bidirectional for simplicity in hackathon
            G.add_edge(road.target_id, road.source_id, weight=road.travel_time, id=road.id)
    return G


def find_best_route(
    db: Session, source_id: str, target_id: str, city: Optional[str] = None
) -> Optional[Dict]:
    G = build_graph(db, city)
    try:
        path = nx.shortest_path(G, source=source_id, target=target_id, weight="weight")
        length = nx.shortest_path_length(G, source=source_id, target=target_id, weight="weight")

        # Convert node path to edge IDs
        edge_path = []
        for i in range(len(path) - 1):
            edge_data = G.get_edge_data(path[i], path[i + 1])
            edge_path.append(edge_data["id"])

        return {
            "path_nodes": path,
            "path_edges": edge_path,
            "travel_time": length,
        }
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None


def find_alternate_routes(
    db: Session, source_id: str, target_id: str, city: Optional[str] = None, limit: int = 2
) -> list:
    """Simple k-shortest candidate routes that avoid the primary path, used by
    the reallocation engine and surfaced as alternate routes in the UI."""
    G = build_graph(db, city)
    try:
        paths = nx.shortest_simple_paths(G, source=source_id, target=target_id, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound, nx.NetworkXError):
        return []

    routes = []
    for path in paths:
        edge_path = []
        total = 0.0
        for i in range(len(path) - 1):
            data = G.get_edge_data(path[i], path[i + 1])
            edge_path.append(data["id"])
            total += data["weight"]
        routes.append({"path_nodes": path, "path_edges": edge_path, "travel_time": total})
        if len(routes) >= limit:
            break
    return routes