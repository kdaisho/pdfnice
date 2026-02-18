## Docker

### Restart the container (keeps data):

```sh
docker compose down && docker compose up -d
```

### Restart + delete all data (fresh start):

```sh
docker compose down -v && docker compose up -d
```

The `-v` flag remove volumes
