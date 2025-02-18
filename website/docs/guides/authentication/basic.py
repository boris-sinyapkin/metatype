# skip:start
from typegraph import typegraph, Policy, t, Graph
from typegraph.graph.params import Auth, Cors
from typegraph.runtimes.deno import DenoRuntime

# skip:end


@typegraph(
    # skip:next-line
    cors=Cors(allow_origin=["https://metatype.dev", "http://localhost:3000"]),
)
def basic_authentication(g: Graph):
    deno = DenoRuntime()
    public = Policy.public()

    ctx = t.struct({"username": t.string().optional().from_context("username")})

    # highlight-next-line
    g.auth(Auth.basic(["admin"]))

    g.expose(
        public,
        get_context=deno.identity(ctx),
    )
