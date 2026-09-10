import os
import chromadb
from chromadb.utils import embedding_functions
from pypdf import PdfReader

class RAGService:
    def __init__(self, storage_path="data/vector_db"):
        os.makedirs(storage_path, exist_ok=True)
        self.client = chromadb.PersistentClient(path=storage_path)
        
        # Lightweight local embeddings running via SentenceTransformers
        self.embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="all-MiniLM-L6-v2"
        )
        
        self.collection = self.client.get_or_create_collection(
            name="sasha_knowledge",
            embedding_function=self.embed_fn
        )

    def extract_text_from_file(self, file_path: str) -> str:
        """Extract text from PDF or plain text files."""
        if file_path.endswith('.pdf'):
            reader = PdfReader(file_path)
            return "\n".join([page.extract_text() or "" for page in reader.pages])
        else:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()

    def chunk_text(self, text: str, chunk_size=500, overlap=50) -> list:
        """Split text into overlapping chunks for context retrieval."""
        words = text.split()
        chunks = []
        for i in range(0, len(words), chunk_size - overlap):
            chunk = " ".join(words[i:i + chunk_size])
            if chunk:
                chunks.append(chunk)
        return chunks

    def ingest_document(self, file_path: str, doc_id: str):
        """Extract, chunk, embed, and store document in ChromaDB."""
        text = self.extract_text_from_file(file_path)
        chunks = self.chunk_text(text)
        
        ids = [f"{doc_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{"source": doc_id, "chunk_index": i} for i in range(len(chunks))]
        
        self.collection.upsert(
            documents=chunks,
            ids=ids,
            metadatas=metadatas
        )
        return len(chunks)

    def query_context(self, query: str, n_results=3) -> str:
        """Fetch top relevant text chunks for a query."""
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        documents = results.get("documents", [[]])[0]
        if not documents:
            return ""
        
        return "\n\n".join(documents)