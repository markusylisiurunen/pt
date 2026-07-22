interface Route {
  (req: Request): Response | Promise<Response>;
}

function userRoute(name: string): Route {
  return (req: Request) => {
    if (req.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    return Response.json({ name });
  };
}

export { userRoute };
