"""
kride_graph_builder.py
======================
GraphRAG를 위한 그래프 빌더 (Artist + POI)
- NoneType 처리 추가 (GraphML 오류 방지)
- 디버깅 출력 추가
"""
import os
import networkx as nx
import psycopg2
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")

def build_graph():
    print("Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    
    G = nx.Graph()
    
    # 1. POI 노드 추가 (tourism, kculture)
    print("Loading POI nodes...")
    poi_df = pd.read_sql("""
        SELECT id, name, category, sub_category, address, 
               ST_Y(geom::geometry) as lat, ST_X(geom::geometry) as lon
        FROM poi
        WHERE category IN ('tourism', 'kculture', 'kpop')
    """, conn)
    
    # None 값을 빈 문자열로 변환 (GraphML 에러 방지)
    poi_df = poi_df.fillna("")
    
    for _, row in poi_df.iterrows():
        node_id = f"poi_{row['id']}"
        G.add_node(node_id, 
                   type='POI',
                   name=str(row['name']),
                   category=str(row['category']),
                   sub_category=str(row['sub_category']),
                   address=str(row['address']),
                   lat=float(row['lat']) if row['lat'] != "" else 0.0,
                   lon=float(row['lon']) if row['lon'] != "" else 0.0)
        
    # 2. Artist 노드 추가
    print("Loading Artist nodes...")
    artist_df = pd.read_sql("SELECT id, name, category FROM artist", conn)
    artist_df = artist_df.fillna("")
    
    for _, row in artist_df.iterrows():
        node_id = f"artist_{row['id']}"
        G.add_node(node_id, 
                   type='Artist',
                   name=str(row['name']),
                   category=str(row['category']))
        
    # 3. FILMING_AT 엣지 추가
    print("Loading FILMING_AT edges...")
    edges_df = pd.read_sql("""
        SELECT artist_id, poi_id, relationship_type
        FROM artist_poi
    """, conn)
    
    edge_count = 0
    for _, row in edges_df.iterrows():
        u = f"artist_{row['artist_id']}"
        v = f"poi_{row['poi_id']}"
        if u in G and v in G:
            G.add_edge(u, v, relationship=str(row['relationship_type']))
            edge_count += 1
        else:
            # 디버깅용
            if edge_count < 5:
                print(f"Warning: Node not found for edge {u} -> {v}")
    
    print(f"Edges successfully added to graph: {edge_count}")
        
    # 4. Community Detection (GraphRAG 전문성 추가)
    print("Performing community detection...")
    try:
        from networkx.algorithms import community
        # 노드가 많고 엣지가 적은 경우 modularity_communities가 느릴 수 있으므로 엣지가 있는 노드만 대상으로 하거나 타임아웃 고려
        # 여기서는 일단 실행
        communities = community.greedy_modularity_communities(G)
        for i, comm in enumerate(communities):
            for node in comm:
                G.nodes[node]['community'] = i
    except Exception as e:
        print(f"Community detection failed: {e}")
    
    print(f"Graph built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    
    # 5. 저장
    os.makedirs("models", exist_ok=True)
    output_path = "models/kride_graph.graphml"
    
    # GraphML 저장을 위해 모든 속성을 문자열 또는 숫자로 강제 변환
    for n, d in G.nodes(data=True):
        for k, v in d.items():
            if v is None: d[k] = ""
            
    try:
        nx.write_graphml(G, output_path)
        print(f"Graph saved to {output_path}")
    except Exception as e:
        print(f"GraphML save failed: {e}")
    
    # JSON 형식으로도 저장 (RAG 시스템에서 읽기 편하게)
    import json
    nodes = []
    for n, d in G.nodes(data=True):
        node_data = d.copy()
        node_data['id'] = n
        nodes.append(node_data)
    
    edges = []
    for u, v, d in G.edges(data=True):
        edge_data = d.copy()
        edge_data['source'] = u
        edge_data['target'] = v
        edges.append(edge_data)
    
    with open("models/kride_graph.json", "w", encoding='utf-8') as f:
        json.dump({'nodes': nodes, 'edges': edges}, f, ensure_ascii=False, indent=2)
    print("Graph JSON saved to models/kride_graph.json")
    
    conn.close()
    return G

if __name__ == "__main__":
    build_graph()
