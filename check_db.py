import chromadb
try:
    client = chromadb.HttpClient(host='localhost', port=8100)
    print("Collections:")
    for c in client.list_collections():
        print(c.name, c.count())
except Exception as e:
    print(e)
