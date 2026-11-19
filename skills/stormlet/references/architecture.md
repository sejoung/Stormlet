# Architecture boards

How to turn a system into a Stormlet board. Read SKILL.md first. This page adds what is specific to diagrams: what to draw from code, how to split a large system into C4 levels, and how to add a legend.

## The shape of a diagram

| Thing                                                                             | Board object                                                                                                                              |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Something deployed or stored: a service, worker, function, database, cache, queue | A note of `"width": 200, "height": 120` with an `icon`. The first line is the role, the second the technology: `"Orders DB\nPostgreSQL"`. |
| A person, client or external system                                               | A loose note, outside every boundary                                                                                                      |
| A boundary: cloud, account, region, network, subnet, cluster, namespace, team     | A frame. Nest frames with `frame`.                                                                                                        |
| A call, a request or data moving                                                  | A line from the caller to the callee. The label says how (`HTTPS`, `gRPC`, `SQL`, `publish`). Asynchronous lines are `"dashed": true`.    |

Choose the direction once, for the whole board:

- `"layout": "flow"` (left to right) for request paths: users on the left, data and partners on the right.
- `"layout": "flow-down"` (top to bottom) for layered stacks: entry points on top, storage at the bottom.

Give each boundary the same direction as the board when its parts call one another, or `"column"`/`"row"` for a tier of peers. Keep a diagram under about 30 components; split a larger one into C4 levels.

## From code

Read the files the user points to, or find them in the repository, and map them as follows. Write one note per component, not one per replica or file. Name it as the code does, so the board and the code can be compared.

### docker-compose.yml

| Compose                                           | Board                                                                                                                                                                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The project                                       | A frame titled after the project, with `"layout": "flow"`                                                                                                                                                                          |
| `services.<name>`                                 | A note. The icon follows the image: `database` for postgres, mysql or mongo; `cache` for redis or memcached; `queue` for rabbitmq or kafka; `web` for nginx or a frontend; otherwise `service`. The second line is the image name. |
| `depends_on`, or a service's URL in `environment` | A line from the service to what it uses                                                                                                                                                                                            |
| `ports`                                           | A loose `user` or `web` note outside the frame, with a line to the service, labelled with the port                                                                                                                                 |
| `networks`                                        | Nested frames, when there is more than one network                                                                                                                                                                                 |
| `volumes`                                         | A `storage` note with a line from the service                                                                                                                                                                                      |

### Kubernetes manifests and Helm charts

| Kind                                                       | Board                                                                                                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cluster                                                    | A frame with `"layout": "flow-down"`                                                                                                                |
| `Namespace`                                                | A frame inside the cluster frame, with `"layout": "flow-down"`                                                                                      |
| `Ingress`, `Gateway`                                       | A `k8s-ingress` note; one line per rule to its `Service`, labelled with the host or path                                                            |
| `Service`                                                  | A `k8s-service` note, with a line to the workload its selector matches                                                                              |
| `Deployment`, `StatefulSet`, `DaemonSet`, `Job`, `CronJob` | A note with `k8s-deployment`, `k8s-statefulset`, `k8s-daemonset`, `k8s-job` or `k8s-cronjob`. The second line is the replica count or the schedule. |
| `ConfigMap`, `Secret`                                      | A `k8s-configmap` or `k8s-secret` note in `gray`, with a dashed line from each workload that mounts or reads it                                     |
| `PersistentVolumeClaim`                                    | A `k8s-volume` note, with a line from the workload                                                                                                  |
| `HorizontalPodAutoscaler`                                  | A `k8s-autoscaler` note in `gray`, with a dashed line labelled `scales` to its target                                                               |
| Image registry, external database, SaaS                    | A loose note outside the cluster                                                                                                                    |
| A Helm chart                                               | A `k8s-helm` note, or a frame titled after the release                                                                                              |

Do not draw Pods, ReplicaSets or Endpoints that a Deployment manages; mention the replica count instead.

### Terraform and other cloud code

| Resource                                         | Board                                              |
| ------------------------------------------------ | -------------------------------------------------- |
| Account, project, VPC or virtual network, subnet | Nested frames, outermost first                     |
| Load balancer, API gateway, CDN                  | `load-balancer`, `gateway` or `web` notes in `sky` |
| Virtual machine, container service, app service  | `server` or `container` notes in `blue`            |
| Serverless function                              | `function` notes in `blue`                         |
| Managed database, cache, object storage          | `database`, `cache` or `storage` notes in `green`  |
| Queue, topic, stream                             | `queue` or `stream` notes in `purple`              |
| Identity, keys, secrets manager                  | `auth`, `key` or `lock` notes in `gray`            |
| Monitoring, logs                                 | `monitoring` or `logs` notes in `gray`             |

Lines come from references between resources, such as a function's event source, a security group rule or an environment variable naming another resource. Leave out resources that only configure others (policies, attachments, rules), unless the user asks about security.

## C4 levels

For a larger system, draw the [C4 model](https://c4model.com)'s levels as separate frames on one board, with a top-level `"layout": "column"`, or as separate boards:

1. **Context**: one frame titled "1. System context". People (`user`, `team`) and external systems (`external`) around a single note for the whole system.
2. **Containers**: one frame titled "2. Containers", with `"layout": "flow"`. Each application and data store of the system is a note.
3. **Components**: one frame per container worth opening up, titled "3. Components · <container>", with the parts inside that container.

A note at one level can be repeated at the next with the same text, so the levels read as zooming in.

## Legend

When colors or icons carry meaning, end the board with a frame titled "Legend" and `"layout": "row"`. Put one note in it per role, sized `"width": 160, "height": 80`, with that role's color and icon and its name as the text: "Service", "Data store", "Queue", "External system".
